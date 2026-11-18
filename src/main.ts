import { mount } from 'svelte';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import './app.css';
import App from './App.svelte';

// The website installs updates in the background and applies them between songs (see App.svelte).
// The iOS app ships its files inside the app, so it needs no service worker.
if (!Capacitor.isNativePlatform()) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      (window as unknown as { __kfUpdate?: () => void }).__kfUpdate = () => updateSW(true);
      window.dispatchEvent(new Event('kf-update'));
    },
  });
}

const app = mount(App, { target: document.getElementById('app')! });

export default app;
