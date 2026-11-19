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
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, '**/*.node.test.{ts,tsx}'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotFailures: false,
            instances: [
              { browser: 'chromium', name: 'chromium' },
              {
                browser: 'firefox',
                name: 'firefox',
                provider: playwright({
                  launchOptions: {
                    firefoxUserPrefs: {
                      // Vitest sets this preference to `true`. With that value, Firefox sometimes
                      // crashes a page when the page starts.
                      'dom.multiple_import_maps.enabled': false,
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
