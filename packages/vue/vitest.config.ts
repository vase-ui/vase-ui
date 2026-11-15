import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';
import { renderOnServer } from './test/server/renderOnServer.ts';
import { probeLog } from './test/server/probe.ts';
import { collectGarbage } from './test/server/collectGarbage.ts';

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
    setupFiles: ['./test/setup.ts', ...(process.env.PROBE_COLLECT ? ['./test/server/probeCollect.ts'] : [])],
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
            commands: { renderOnServer, probeLog, collectGarbage },
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
                    env: { ...process.env, ...(process.env.PROBE_GC_FILE ? { MOZ_GCTIMER: process.env.PROBE_GC_FILE, MOZ_CCTIMER: process.env.PROBE_GC_FILE } : {}), ...(process.env.PROBE_PROFILE ? { MOZ_PROFILER_STARTUP: '1', MOZ_PROFILER_SHUTDOWN: process.env.PROBE_PROFILE, MOZ_PROFILER_STARTUP_FEATURES: process.env.PROBE_PROFILE_FEATURES ?? 'nostacksampling,ipcmessages', MOZ_PROFILER_STARTUP_FILTERS: 'GeckoMain,Socket Thread', MOZ_PROFILER_STARTUP_ENTRIES: '64000000', MOZ_PROFILER_STARTUP_DURATION: process.env.PROBE_PROFILE_DURATION ?? '80' } : {}) },
                    firefoxUserPrefs: {
                      // Vitest sets this preference to `true`. With that value, Firefox sometimes
                      // crashes a page when the page starts. With `false`, Vitest mocks a module by
                      // request interception, not by import map.
                      'dom.multiple_import_maps.enabled': false,
                      ...(process.env.PROBE_MEM_LOG ? { 'javascript.options.mem.log': true, 'devtools.console.stdout.chrome': true, 'browser.dom.window.dump.enabled': true } : {}),
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
