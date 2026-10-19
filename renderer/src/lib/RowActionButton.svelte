<script lang="ts">
    export let title: string;
    /** 'danger' is the pulsing button that asks to confirm a delete */
    export let variant: 'default' | 'danger' = 'default';
</script>

<button
        class="action-button"
        class:confirm-delete-button={variant === 'danger'}
        on:click|stopPropagation
        {title}
        aria-label={title}
>
    <slot/>
</button>

<style>
    .action-button {
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

    .action-button:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }

    .confirm-delete-button {
        color: var(--interactive-danger);
        animation: pulse 0.5s ease-in-out;
    }

    .confirm-delete-button:hover {
        background: var(--interactive-danger);
        color: white;
    }

    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.1);
        }
    }
</style>
