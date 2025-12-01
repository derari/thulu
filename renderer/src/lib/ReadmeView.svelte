<script lang="ts">
    import { Parser, HtmlRenderer } from 'commonmark';
    import { onMount } from 'svelte';
    import { X } from 'lucide-svelte';
    import { openFile } from './stores/openFile.js';

    export let folderPath: string;
    export let name: string = 'README';
    export let onClose: () => void;

    interface ReadmeFile {
        name: string;
        content: string;
    }

    var readmeFiles: ReadmeFile[] = [];
    var loading = true;
    var error = '';

    const READ_ME = 'README.md';
    const MARK_DOWN_EXT = '.md';

    async function listMarkdownFiles(): Promise<string[]> {
        const entries = await window.electronAPI.listDirectory(folderPath);
        return entries
            .filter(entry => entry.isFile && entry.name.endsWith(MARK_DOWN_EXT))
            .map(entry => entry.name)
            .sort((a, b) => {
                if (a === READ_ME) return -1;
                if (b === READ_ME) return 1;
                return a.localeCompare(b);
            });
    }

    function renderMarkdown(markdown: string): string {
        const parser = new Parser();
        const renderer = new HtmlRenderer();
        const ast = parser.parse(markdown);
        var html = renderer.render(ast);
        html = linkifyUrls(html);
        html = stripImageSources(html);
        return html;
    }

    function stripImageSources(html: string): string {
        return html.replace(/<img([^>]*)src="([^"]*)"([^>]*)>/g, '<img$1data-src="$2"$3>');
    }

    function linkifyUrls(html: string): string {
        const urlPattern = /(?<!href=["'])(https?:\/\/[^\s<>"{}|\\^`\[\]]*)/g;
        return html.replace(urlPattern, '<a href="$1" class="external-link">$1</a>');
    }

    function handleLinkClick(event: Event) {
        const target = event.target as HTMLAnchorElement;
        if (!target.href) return;

        if (target.href.startsWith('http://') || target.href.startsWith('https://')) {
            if (isLocalHttpFile(target.href)) {
                event.preventDefault();
                handleOpenHttpFile(target.href);
                return;
            }
            event.preventDefault();
            window.electronAPI.openExternal(target.href);
            return;
        }

        if (isRelativeHttpFile(target.href)) {
            event.preventDefault();
            handleOpenHttpFile(target.href);
        }
    }

    function isLocalHttpFile(href: string): boolean {
        return href.includes('localhost') && href.includes('.http');
    }

    function isRelativeHttpFile(href: string): boolean {
        const normalizedHref = href.replace(/\\/g, '/').toLowerCase();
        return normalizedHref.endsWith('.http') && !normalizedHref.startsWith('http');
    }

    function extractPathFromLocalhostUrl(url: string): string {
        const urlObj = new URL(url);
        return urlObj.pathname;
    }

    function resolveFilePath(pathOrUrl: string): string {
        var filePath = pathOrUrl;

        if (pathOrUrl.includes('localhost')) {
            filePath = extractPathFromLocalhostUrl(pathOrUrl);
        }

        const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
        const separator = folderPath.includes('\\') ? '\\' : '/';
        return `${folderPath}${separator}${normalizedPath}`;
    }

    async function handleOpenHttpFile(pathOrUrl: string) {
        const filePath = resolveFilePath(pathOrUrl);
        const exists = await window.electronAPI.fileExists(filePath);

        if (exists) {
            await openFile.openFile(filePath);
            onClose();
        }
    }

    async function loadReadmeFiles() {
        try {
            loading = true;
            error = '';
            const fileNames = await listMarkdownFiles();
            readmeFiles = [];

            for (const fileName of fileNames) {
                const filePath = `${folderPath}/${fileName}`;
                const content = await window.electronAPI.readFile(filePath);
                if (content) {
                    readmeFiles.push({ name: fileName, content });
                }
            }

            if (readmeFiles.length === 0) {
                error = 'No markdown files found';
            }
        } catch (err) {
            error = `Error loading readme files: ${err}`;
        } finally {
            loading = false;
        }
    }

    function attachLinkHandlers() {
        const links = document.querySelectorAll('.markdown-content a');
        links.forEach(link => {
            link.addEventListener('click', handleLinkClick);
        });
    }

    async function fixImageSources() {
        const images = document.querySelectorAll('.markdown-content img[data-src]');

        for (const img of images) {
            const src = img.getAttribute('data-src');
            if (!src) continue;

            var filePath = src;

            if (src.includes('localhost')) {
                try {
                    const urlObj = new URL(src);
                    filePath = urlObj.pathname;
                } catch (e) {
                    continue;
                }
            }

            const resolvedPath = resolveFilePath(filePath);

            try {
                const imageContent = await window.electronAPI.readFileBinary(resolvedPath);
                if (imageContent) {
                    const ext = resolvedPath.toLowerCase().split('.').pop();
                    const mimeType = getMimeType(ext);
                    img.setAttribute('src', `data:${mimeType};base64,${imageContent}`);
                    img.removeAttribute('data-src');
                }
            } catch (e) {
                continue;
            }
        }
    }

    function getMimeType(ext: string | undefined): string {
        const mimeTypes: Record<string, string> = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml'
        };
        return mimeTypes[ext?.toLowerCase() || ''] || 'image/png';
    }

    onMount(async () => {
        await loadReadmeFiles();
        attachLinkHandlers();
        await fixImageSources();
    });
</script>

<div class="readme-view-overlay" on:click={onClose} role="presentation">
    <div class="readme-view-modal" on:click|stopPropagation>
        <div class="readme-header">
            <h2>{name}</h2>
            <button
                class="close-button"
                on:click={onClose}
                title="Close"
                aria-label="Close readme view"
            >
                <X size={20}/>
            </button>
        </div>

        <div class="readme-content">
            {#if loading}
                <div class="loading">Loading...</div>
            {:else if error}
                <div class="error">{error}</div>
            {:else if readmeFiles.length > 0}
                {#each readmeFiles as file (file.name)}
                    <div class="readme-section">
                        <h3 class="file-header">{file.name}</h3>
                        <div class="markdown-content">
                            {@html renderMarkdown(file.content)}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    </div>
</div>

<style>
    .readme-view-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .readme-view-modal {
        background: var(--bg-primary);
        border: 1px solid var(--border-default);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        max-width: 800px;
        max-height: 80vh;
        width: 90%;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }

    .readme-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem;
        border-bottom: 1px solid var(--border-default);
        flex-shrink: 0;
    }

    .readme-header h2 {
        margin: 0;
        font-size: 1.25rem;
        color: var(--text-primary);
    }

    .close-button {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 0.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        transition: all 0.2s;
    }

    .close-button:hover {
        color: var(--text-primary);
        background: var(--bg-tertiary);
    }

    .readme-content {
        overflow-y: auto;
        padding: 1.5rem;
        flex: 1;
    }

    .loading {
        text-align: center;
        color: var(--text-secondary);
        padding: 2rem;
    }

    .error {
        text-align: center;
        color: var(--interactive-danger);
        padding: 2rem;
    }

    .readme-section {
        margin-bottom: 2rem;
    }

    .readme-section:last-child {
        margin-bottom: 0;
    }

    .file-header {
        font-size: 1rem;
        color: var(--text-secondary);
        margin: 0 0 1rem 0;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--border-default);
    }

    .markdown-content {
        color: var(--text-primary);
        line-height: 1.6;
    }

    :global(.markdown-content h1) {
        font-size: 1.5rem;
        margin: 1rem 0 0.5rem 0;
        color: var(--text-primary);
    }

    :global(.markdown-content h2) {
        font-size: 1.25rem;
        margin: 0.875rem 0 0.4375rem 0;
        color: var(--text-primary);
    }

    :global(.markdown-content h3) {
        font-size: 1.1rem;
        margin: 0.75rem 0 0.375rem 0;
        color: var(--text-primary);
    }

    :global(.markdown-content p) {
        margin: 0.5rem 0;
    }

    :global(.markdown-content ul),
    :global(.markdown-content ol) {
        margin: 0.5rem 0;
        padding-left: 2rem;
    }

    :global(.markdown-content li) {
        margin: 0.25rem 0;
    }

    :global(.markdown-content code) {
        background: var(--bg-tertiary);
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        font-family: 'Monaspace Neon', 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 0.9em;
    }

    :global(.markdown-content pre) {
        background: var(--bg-tertiary);
        border: 1px solid var(--border-default);
        border-radius: 4px;
        padding: 1rem;
        overflow-x: auto;
        margin: 1rem 0;
    }

    :global(.markdown-content pre code) {
        background: transparent;
        padding: 0;
        font-size: 0.85em;
    }

    :global(.markdown-content blockquote) {
        border-left: 3px solid var(--border-default);
        margin: 0.5rem 0;
        padding-left: 1rem;
        color: var(--text-secondary);
    }

    :global(.markdown-content a) {
        color: var(--interactive-primary);
        text-decoration: none;
    }

    :global(.markdown-content a:hover) {
        text-decoration: underline;
    }
</style>

