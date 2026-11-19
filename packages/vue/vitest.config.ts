import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';
import { browserInstances, serverRenderCommands } from './test/browserConfig.ts';

export default defineConfig({
  plugins: [vue(), vueJsx()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
  },
  resolve: {
    tsconfigPaths: true,
  },
  // Vite finds `axe-core` during a run, and its reload stops the tests in that browser.
  optimizeDeps: { include: ['axe-core'] },
  test: {
    passWithNoTests: true,
    retry: 0,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.node.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          include: ['src/**/*.test.{ts,tsx}', 'test/measurements/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.node.test.{ts,tsx}'],
          provide: { app: 'vdom' },
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotFailures: false,
            commands: serverRenderCommands({ plugins: [vue()], resolve: { tsconfigPaths: true } }),
            instances: browserInstances(),
          },
        },
      },
    ],
  },
});
