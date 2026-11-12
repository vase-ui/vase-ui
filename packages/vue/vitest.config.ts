import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue(), vueJsx()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    sequence: {
      hooks: 'list',
    },
    retry: 0,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          env: { TZ: 'UTC' },
          include: ['src/**/*.node.test.{ts,tsx}', 'test/**/*.node.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, '**/*.node.test.{ts,tsx}'],
          browser: {
            enabled: true,
            provider: playwright({ contextOptions: { timezoneId: 'UTC' } }),
            headless: true,
            screenshotFailures: false,
            instances: [
              { browser: 'chromium', name: 'chromium' },
              { browser: 'firefox', name: 'firefox' },
              { browser: 'webkit', name: 'webkit' },
            ],
          },
        },
      },
    ],
  },
});
