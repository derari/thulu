<script lang="ts">
    import '@fontsource/inter/latin.css';
    import '@fontsource/monaspace-neon/latin.css';

    import {onMount} from 'svelte';
    import PreferencesModal from '$lib/PreferencesModal.svelte';
    import Sidebar from '$lib/Sidebar.svelte';
    import MainView from '$lib/MainView.svelte';
    import ThemeProvider from '$lib/ThemeProvider.svelte';

    var showPreferences = false;

    function handlePreferencesOpen() {
        showPreferences = true;
    }

    function handlePreferencesClose() {
        showPreferences = false;
    }

    onMount(() => {
        window.electronAPI.onPreferencesOpen(handlePreferencesOpen);
    });
</script>

<ThemeProvider>
    <div class="main-layout">
        <Sidebar/>
        <div class="main-content">
            <MainView/>
        </div>
    </div>
</ThemeProvider>

{#if showPreferences}
    <PreferencesModal onClose={handlePreferencesClose}/>
{/if}

<style>
    .main-layout {
        display: flex;
        height: 100%;
        width: 100%;
        background: var(--bg-primary);
        overflow: hidden;
    }

    .main-content {
        flex: 1;
        overflow: hidden;
        background: var(--bg-primary);
        display: flex;
        flex-direction: column;
    }
</style>
