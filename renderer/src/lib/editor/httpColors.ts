export function getVerbColor(verb: string): string {
    switch (verb?.toUpperCase()) {
        case 'GET':     return 'var(--http-verb-get)';
        case 'POST':    return 'var(--http-verb-post)';
        case 'PUT':     return 'var(--http-verb-put)';
        case 'PATCH':   return 'var(--http-verb-patch)';
        case 'DELETE':  return 'var(--http-verb-delete)';
        default:        return 'var(--http-verb-other)';
    }
}

export function formatVerb(verb: string): string {
    const upper = verb.toUpperCase();
    if (upper === 'PATCH') return 'PTCH';
    if (upper === 'DELETE') return 'DEL';
    if (upper === 'OPTIONS') return 'OPT';
    return upper.substring(0, 4);
}

export function getStatusColor(statusCode: number): string {
    if (statusCode >= 100 && statusCode < 200) return 'var(--http-status-info)';
    if (statusCode >= 200 && statusCode < 300) return 'var(--http-status-success)';
    if (statusCode >= 300 && statusCode < 400) return 'var(--http-status-redirect)';
    if (statusCode >= 400 && statusCode < 500) return 'var(--http-status-client-error)';
    if (statusCode >= 500) return 'var(--http-status-server-error)';
    return 'var(--http-verb-other)';
}
