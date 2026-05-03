<script lang="ts">
    import {onMount} from 'svelte';
    import type {HistoryMeta} from './collection.js';
    import {httpResponse} from './stores/httpResponse.js';
    import {getStatusColor, getVerbColor} from './editor/httpColors.js';

    export let collectionPath: string;
    export let onSelect: () => void;

    let entries: HistoryMeta[] = [];
    let loading = true;
    let error = '';

    onMount(async () => {
        try {
            const raw = await window.electronAPI.listHistory(collectionPath);
            entries = raw as unknown as HistoryMeta[];
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            loading = false;
        }
    });

    // Group entries by date label
    type Group = { label: string; entries: HistoryMeta[] };

    function getDateLabel(timestamp: string): string {
        const d = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

        // "May 1" or "Apr 30, 2024" if different year
        const sameYear = d.getFullYear() === today.getFullYear();
        return d.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            ...(sameYear ? {} : { year: 'numeric' })
        });
    }

    function formatTime(timestamp: string): string {
        const d = new Date(timestamp);
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }

    $: groups = (() => {
        const map = new Map<string, HistoryMeta[]>();
        for (const entry of entries) {
            const label = getDateLabel(entry.timestamp);
            if (!map.has(label)) map.set(label, []);
            map.get(label)!.push(entry);
        }
        const result: Group[] = [];
        for (const [label, group] of map) {
            result.push({ label, entries: group });
        }
        return result;
    })();

    async function selectEntry(entry: HistoryMeta) {
        const basePath = `${collectionPath}/.thulu/responses/${entry.id}`;

        const responseIsBinary = entry.responseBodyEncoding === 'base64';
        const showResponseWidget = entry.responseBodyFile &&
            (responseIsBinary || (entry.responseBodySize ?? 0) > 1_048_576);

        let responseBodyBytes = '';
        let responseBodyFilePath: string | undefined;
        let responseBodySize: number | undefined;

        if (entry.responseBodyFile) {
            responseBodyFilePath = `${basePath}/${entry.responseBodyFile}`;
            responseBodySize = entry.responseBodySize;
            if (!showResponseWidget) {
                if (entry.responseBodyEncoding === 'base64') {
                    // binary body is not needed
                    responseBodyBytes = '';
                } else {
                    // UTF-8 text — re-encode to base64 bytes
                    const text = (await window.electronAPI.readFile(`${basePath}/${entry.responseBodyFile}`)) ?? '';
                    responseBodyBytes = btoa(unescape(encodeURIComponent(text)));
                }
            }
        }

        let requestBody: string | undefined;
        let requestBodyFilePath: string | undefined;
        let requestBodySize: number | undefined;

        if (entry.requestBodyFile) {
            requestBodyFilePath = `${basePath}/${entry.requestBodyFile}`;
            requestBodySize = entry.requestBodySize;
            const reqIsBig = (entry.requestBodySize ?? 0) > 1_048_576;
            if (!reqIsBig) {
                requestBody = (await window.electronAPI.readFile(`${basePath}/${entry.requestBodyFile}`)) ?? undefined;
            }
        }

        httpResponse.setResponse({
            statusLine: entry.statusLine,
            headers: entry.responseHeaders,
            bodyBytes: responseBodyBytes,
            timeMs: entry.timeMs,
            redirects: entry.redirects,
            resolvedRequest: {
                method: entry.verb,
                url: entry.url,
                headers: entry.requestHeaders,
                body: requestBody
            },
            responseBodyFilePath,
            responseBodySize,
            requestBodyFilePath,
            requestBodySize,
        });

        onSelect();
    }
</script>

<div class="history-view">
    {#if loading}
        <p class="state-message">Loading…</p>
    {:else if error}
        <p class="state-message error">Failed to load history: {error}</p>
    {:else if entries.length === 0}
        <p class="state-message">No history yet</p>
    {:else}
        {#each groups as group}
            <div class="date-divider">{group.label}</div>
            {#each group.entries as entry}
                <button class="entry" on:click={() => selectEntry(entry)}>
                    <span class="time">{formatTime(entry.timestamp)}</span>
                    <span class="section">{entry.sectionName || entry.requestFile}</span>
                    <span class="verb" style="color: {getVerbColor(entry.verb)}">{entry.verb}</span>
                    <span class="url" title={entry.url}>{entry.url}</span>
                    <span class="status" style="color: {getStatusColor(entry.statusCode)}">{entry.statusCode}</span>
                    <span class="duration">{entry.timeMs}ms</span>
                </button>
            {/each}
        {/each}
    {/if}
</div>

<style>
    .history-view {
        flex: 1;
        overflow-y: auto;
        background: var(--editor-bg);
        display: flex;
        flex-direction: column;
    }

    .state-message {
        color: var(--text-secondary);
        font-style: italic;
        text-align: center;
        padding: 2rem 1rem;
        margin: 0;
    }

    .state-message.error {
        color: #f44747;
    }

    .date-divider {
        padding: 0.3rem 0.75rem;
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--text-secondary);
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-default);
        position: sticky;
        top: 0;
    }

    .entry {
        display: grid;
        grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem minmax(0, 2fr) 2rem 3.5rem;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35rem 0.75rem;
        background: none;
        border: none;
        border-bottom: 1px solid var(--border-default);
        cursor: pointer;
        text-align: left;
        width: 100%;
        color: var(--text-primary);
        font-size: 0.8rem;
    }

    .entry:hover {
        background: var(--bg-hover, var(--border-default));
    }

    .time {
        color: var(--text-secondary);
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .verb {
        font-weight: 700;
        font-size: 0.7rem;
        white-space: nowrap;
    }

    .section {
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .url {
        color: var(--text-secondary);
        font-size: 0.75rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .status {
        font-weight: 700;
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
        text-align: right;
    }

    .duration {
        color: var(--text-secondary);
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
        text-align: right;
        white-space: nowrap;
    }
</style>

