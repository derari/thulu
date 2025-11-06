import * as vm from 'vm';

export interface ScriptExecutionParams {
	code: string;
	timeout: number;
	collectionPath?: string;
	responseBody?: string;
	responseContentType?: string;
}

export interface ScriptExecutionResult {
	success: boolean;
	error?: string;
	logs: string[];
	globalVariableChanges?: Record<string, string>;
}

const DEFAULT_TIMEOUT = 5000;

export function executeScript(params: ScriptExecutionParams): ScriptExecutionResult {
	const { code, timeout = DEFAULT_TIMEOUT, collectionPath, responseBody, responseContentType } = params;
	const logs: string[] = [];
	const globalVariableChanges: Record<string, string> = {};

	const isJsonContentType = responseContentType &&
		(responseContentType.includes('application/json') ||
		 responseContentType.includes('+json'));

	let parsedBody: unknown = responseBody;
	if (responseBody && isJsonContentType) {
		try {
			parsedBody = JSON.parse(responseBody);
		} catch {
			parsedBody = responseBody;
		}
	}

	try {
		const sandbox = {
			console: {
				log: (...args: unknown[]) => {
					logs.push(args.map(arg => String(arg)).join(' '));
				}
			},
			client: {
				global: {
					set: (key: string, value: string) => {
						if (!collectionPath) {
							logs.push('Warning: Cannot set global variable - no collection path provided');
							return;
						}
						globalVariableChanges[key] = value;
					}
				}
			},
            response: {
                body: parsedBody
            }
		};

		const context = vm.createContext(sandbox);

		vm.runInContext(code, context, {
			timeout,
			displayErrors: true
		});

		return {
			success: true,
			logs,
			globalVariableChanges: Object.keys(globalVariableChanges).length > 0 ? globalVariableChanges : undefined
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			logs
		};
	}
}

