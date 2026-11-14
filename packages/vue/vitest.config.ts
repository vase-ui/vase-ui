import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';
import { renderOnServer } from './test/server/renderOnServer.ts';

const contextOptions = { timezoneId: 'UTC' };

export default defineConfig({
  plugins: [vue(), vueJsx()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
  },
  resolve: {
    tsconfigPaths: true,
    // A demo is outside this package, so the `paths` of this package do not apply to it.
    // A test job has no `dist`.
    alias: [
      { find: /^@vase-ui\/vue\/([^/]+)$/, replacement: `${import.meta.dirname}/src/$1/index.ts` },
    ],
  },
  test: {
    sequence: {
      hooks: 'list',
    },
    retry: 0,
    setupFiles: ['./test/setup.ts'],
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
            provider: playwright({ contextOptions }),
            headless: true,
            screenshotFailures: false,
            commands: { renderOnServer },
            instances: [
              { browser: 'chromium', name: 'chromium' },
              {
                browser: 'firefox',
                name: 'firefox',
                provider: playwright({
                  contextOptions,
                  launchOptions: {
                    firefoxUserPrefs: {
                      // Vitest sets this preference to `true`. With that value, Firefox sometimes
                      // crashes a page when the page starts. With `false`, Vitest mocks a module by
                      // request interception, not by import map.
                      'dom.multiple_import_maps.enabled': false,
                      // Without this preference, a test in Firefox has no `Touch` and no
                      // `TouchEvent`. The ported touch cases of Base UI construct a `Touch`.
                      'dom.w3c_touch_events.enabled': 1,
                    },
                  },
                }),
              },
              { browser: 'webkit', name: 'webkit' },
            ],
          },
        },
      },
    ],
  },
});
