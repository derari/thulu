import { api } from '../api';
import { dirName, relativePath } from '../paths';
import { globalVariables } from '../stores/globalVariables';
import { httpResponse } from '../stores/httpResponse';
import type { ScriptExecutionResult } from '$shared/ipc';
import { parseHttpFile } from './httpParser';
import { executeHttpRequest, type HttpRequestResponse } from './httpRequestExecutor';

export interface RunRequestParams {
    /** Current text of the .http file, including unsaved edits */
    content: string;
    /** Any line inside the section to run */
    sectionLineNumber: number;
    /** Name of the selected environment, or '' for none */
    selectedEnvironment: string;
    filePath: string;
    collectionPath: string;
}

/**
 * Runs one request of an .http file end to end: sends it, applies the results of its
 * post-scripts to the collection's global variables, shows the response and records it in the history.
 */
export async function runRequest(params: RunRequestParams): Promise<void> {
    const { content, sectionLineNumber, selectedEnvironment, filePath, collectionPath } = params;
    const parsedFile = parseHttpFile(content);

    try {
        const response = await executeHttpRequest({
            parsedFile,
            sectionLineNumber,
            selectedEnvironment,
            fileDirectory: dirName(filePath),
            collectionPath,
            globalVariables: globalVariables.get(collectionPath)
        });

        applyScriptResults(collectionPath, response.scriptResults);
        httpResponse.setResponse(response);

        const section = parsedFile.sections.find(
            (s) => sectionLineNumber >= s.startLineNumber && sectionLineNumber < s.endLineNumber
        );
        recordHistory(response, {
            collectionPath,
            requestFile: relativePath(filePath, collectionPath),
            sectionName: section?.name ?? '',
            environment: selectedEnvironment || undefined
        });
    } catch (error) {
        console.error('Request execution failed:', error);
        httpResponse.setResponse({
            statusLine: 'Error',
            headers: {},
            bodyBytes: btoa(error instanceof Error ? error.message : String(error)),
            timeMs: 0
        });
    }
}

function applyScriptResults(collectionPath: string, results: ScriptExecutionResult[] | undefined) {
    if (!results || results.length === 0) {
        return;
    }

    console.log('Post-script results:', results);
    results.forEach((result, index) => {
        if (!result.success) {
            console.error(`Script ${index + 1}: Failed -`, result.error);
            if (result.logs.length > 0) {
                console.log('  Logs:', result.logs);
            }
            return;
        }

        console.log(`Script ${index + 1}: Success`);
        if (result.logs.length > 0) {
            console.log('  Logs:', result.logs);
        }
        if (result.globalVariableChanges) {
            console.log('  Global variable changes:', result.globalVariableChanges);
            for (const [key, value] of Object.entries(result.globalVariableChanges)) {
                globalVariables.set(collectionPath, key, value);
            }
        }
    });
}

function statusCodeOf(statusLine: string): number {
    const match = statusLine.match(/\s(\d+)\s/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Saves the response to the history without delaying the caller, then attaches the saved body
 * file paths to the displayed response so the body link widget can open them.
 */
function recordHistory(
    response: HttpRequestResponse,
    context: { collectionPath: string; requestFile: string; sectionName: string; environment?: string }
): void {
    const { resolvedRequest } = response;

    api.saveHistory({
        ...context,
        timestamp: new Date().toISOString(),
        verb: resolvedRequest?.method ?? '',
        url: resolvedRequest?.url ?? '',
        requestHeaders: resolvedRequest?.headers ?? {},
        requestBody: resolvedRequest?.body,
        statusCode: statusCodeOf(response.statusLine),
        statusLine: response.statusLine,
        responseHeaders: response.headers,
        responseBody: response.bodyBytes,
        timeMs: response.timeMs,
        redirects: response.redirects
    })
        .then((result) => {
            if (!result.entryPath) {
                return;
            }
            // Use the filenames returned by the save: Content-Disposition can override the content-type default
            httpResponse.patchFilePaths({
                responseBodyFilePath: result.responseBodyFile
                    ? `${result.entryPath}/${result.responseBodyFile}`
                    : undefined,
                responseBodySize: response.bodyBytes ? atob(response.bodyBytes).length : undefined,
                requestBodyFilePath: result.requestBodyFile
                    ? `${result.entryPath}/${result.requestBodyFile}`
                    : undefined,
                requestBodySize: resolvedRequest?.body
                    ? new TextEncoder().encode(resolvedRequest.body).length
                    : undefined
            });
        })
        .catch((err) => console.error('Failed to save history entry:', err));
}
