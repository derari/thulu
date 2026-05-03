export function getVerbColor(verb: string): string {
    switch (verb?.toUpperCase()) {
        case 'GET':     return '#4ec9b0';
        case 'POST':    return '#569cd6';
        case 'PUT':     return '#ce9178';
        case 'PATCH':   return '#dcdcaa';
        case 'DELETE':  return '#f44747';
        case 'HEAD':    return '#9cdcfe';
        case 'OPTIONS': return '#c586c0';
        default:        return '#858585';
    }
}

export function getStatusColor(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return '#4ec9b0';
    if (statusCode >= 300 && statusCode < 400) return '#569cd6';
    if (statusCode >= 400 && statusCode < 500) return '#ce9178';
    if (statusCode >= 500) return '#f44747';
    return '#858585';
}

