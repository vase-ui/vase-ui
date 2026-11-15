import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { playwright } from '@vitest/browser-playwright';
import { webkit } from 'playwright';
import { configDefaults, defineConfig } from 'vitest/config';
import { collectGarbage } from './test/server/collectGarbage.ts';
import { probeLog } from './test/server/probe.ts';
import { renderOnServer } from './test/server/renderOnServer.ts';

const contextOptions = { timezoneId: 'UTC' };

export default defineConfig({
  plugins: [vue(), vueJsx(), tailwindcss()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
    __PROBE_HEARTBEAT__: JSON.stringify(process.env.PROBE_HEARTBEAT === '1'),
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
    server: {
      deps: {
        // The server render of a demo loads these libraries as external modules, and each takes the
        // Vue of the docs. A job that installs another Vue in this package then renders with two
        // copies of Vue, and a warning of the second copy does not reach the test. Vite resolves
        // the Vue of an inlined library to the one copy.
        inline: [/vee-validate/, /@tanstack\/(vue-form|vue-store)/, /vue-demi/],
      },
    },
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
          provide: { testApp: 'vdom' },
          exclude: [...configDefaults.exclude, '**/*.node.test.{ts,tsx}'],
          browser: {
            enabled: true,
            provider: playwright({ contextOptions }),
            headless: true,
            screenshotFailures: false,
            commands: { collectGarbage, probeLog, renderOnServer },
            instances: [
              { browser: 'chromium', name: 'chromium' },
              {
                browser: 'firefox',
                name: 'firefox',
                // Firefox has one mouse for all its windows, and each test file that runs at the
                // same time gets a window of its own. When the real pointer leaves the page of one
                // window, Firefox can send the leave events to the page of another window.
                fileParallelism: false,
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
              {
                browser: 'webkit',
                name: 'webkit',
                // On macOS, the Tab key of WebKit skips a button or a checkbox while full keyboard
                // access is off, and it is off by default. WebKit on Linux does not skip them.
                ...(process.platform === 'darwin'
                  ? {
                      provider: playwright({
                        contextOptions,
                        launchOptions: {
                          executablePath: `${import.meta.dirname}/test/webkitFullKeyboardAccess.sh`,
                          env: {
                            ...process.env,
                            ...(process.env.PROBE_JSC_GC && { JSC_logGC: process.env.PROBE_JSC_GC }),
                            VASE_UI_WEBKIT_EXECUTABLE: webkit.executablePath(),
                          },
                        },
                      }),
                    }
                  : process.env.PROBE_JSC_GC
                    ? {
                        provider: playwright({
                          contextOptions,
                          launchOptions: {
                            env: { ...process.env, JSC_logGC: process.env.PROBE_JSC_GC },
                          },
                        }),
                      }
                    : {}),
              },
              // `render` mounts each test in a Vapor app. The project needs Vue 3.6, so `pnpm test`
              // leaves it out.
              { browser: 'chromium', name: 'vapor', provide: { testApp: 'vapor' } },
            ],
          },
        },
      },
    ],
  },
});
