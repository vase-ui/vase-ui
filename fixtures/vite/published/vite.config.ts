import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  root: import.meta.dirname,
  plugins: [vue({ features: { vapor: mode === 'vapor' } })],
  define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  build: {
    lib: {
      entry: `${mode}.mjs`,
      formats: ['iife'],
      name: 'PublishedApp',
      fileName: () => 'client.js',
    },
  },
  test: { include: ['hydration.test.ts'] },
}));
