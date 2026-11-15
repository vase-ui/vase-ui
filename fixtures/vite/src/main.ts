import { createApp } from 'vue';
import App from './App.vue';

// The app mounts in the entry module, before `DOMContentLoaded`. Chromium then restores the form
// state of the page after the mount.
createApp(App).mount('#app');
