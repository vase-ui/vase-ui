import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Two pages: the form, and a page that the visitor goes to before the move back.
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('index.html', import.meta.url)),
        away: fileURLToPath(new URL('away.html', import.meta.url)),
      },
    },
  },
});
