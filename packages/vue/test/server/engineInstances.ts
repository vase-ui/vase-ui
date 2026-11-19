import { playwright } from '@vitest/browser-playwright';
import { webkit } from 'playwright';

export const contextOptions = { timezoneId: 'UTC' };

/** Chromium, Firefox and WebKit. Each name starts with `project`, when one is given. */
export function engineInstances(project?: string) {
  const name = (browser: string) => (project ? `${project} (${browser})` : browser);
  return [
    { browser: 'chromium' as const, name: name('chromium') },
    {
      browser: 'firefox' as const,
      name: name('firefox'),
      // Firefox has one mouse for all its windows, and each test file that runs at the same time
      // gets a window of its own. When the real pointer leaves the page of one window, Firefox can
      // send the leave events to the page of another window.
      fileParallelism: false,
      provider: playwright({
        contextOptions,
        launchOptions: {
          firefoxUserPrefs: {
            // Vitest sets this preference to `true`. With that value, Firefox sometimes crashes a
            // page when the page starts. With `false`, Vitest mocks a module by request
            // interception, not by import map.
            'dom.multiple_import_maps.enabled': false,
            // Without this preference, a test in Firefox has no `Touch` and no `TouchEvent`. The
            // ported touch cases of Base UI construct a `Touch`.
            'dom.w3c_touch_events.enabled': 1,
          },
        },
      }),
    },
    {
      browser: 'webkit' as const,
      name: name('webkit'),
      // On macOS, the Tab key of WebKit skips a button or a checkbox while full keyboard access is
      // off, and it is off by default. WebKit on Linux does not skip them.
      ...(process.platform === 'darwin' && {
        provider: playwright({
          contextOptions,
          launchOptions: {
            executablePath: `${import.meta.dirname}/../webkitFullKeyboardAccess.sh`,
            env: { ...process.env, VASE_UI_WEBKIT_EXECUTABLE: webkit.executablePath() },
          },
        }),
      }),
    },
  ];
}
