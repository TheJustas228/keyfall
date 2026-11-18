import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import './app.css';
import App from './App.svelte';

// New versions install in the background and are applied between songs (see App.svelte).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    (window as unknown as { __kfUpdate?: () => void }).__kfUpdate = () => updateSW(true);
    window.dispatchEvent(new Event('kf-update'));
  },
});

const app = mount(App, { target: document.getElementById('app')! });

export default app;
