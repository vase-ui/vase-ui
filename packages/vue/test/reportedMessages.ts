import { beforeEach, onTestFinished } from 'vitest';
import { version } from 'vue';
import type { App } from 'vue';

const consoleMethods = ['warn', 'error'] as const;

const originalConsole = { warn: console.warn, error: console.error };

// The list exists only while a test runs.
let messages: string[] | undefined;

const activeEffectMessage =
  'console.warn: [Vue warn] Active effect was not restored correctly - this is likely a Vue internal bug.';

/**
 * Says whether a console call is a reported message. On a prerelease of Vue 3.6, one call is not:
 * `Active effect was not restored correctly`. Vue 3.6 clears the active effect before `setup` and
 * does not restore it when `setup` throws. The render effect of the parent then writes the message
 * to `console.warn`. Vue 3.5 does not write it. Vue does not plan to restore its state after an
 * error of `setup`: https://github.com/vuejs/core/issues/16068
 *
 * Delete this function when the tests run a release of Vue 3.6. The version check is then false,
 * and the cases that expect an error of `setup` show what that release does.
 */
export function isReportedMessage(text: string, vueVersion: string): boolean {
  const isVue36Prerelease = vueVersion.startsWith('3.6.0-');
  return !(isVue36Prerelease && text === activeEffectMessage);
}

/**
 * Fails each test that ends with a message that it did not take. A message is a Vue warning of an
 * app that `recordVueWarnings` was called on, or a call to `console.warn` or `console.error` that
 * reaches the console and for which `isReportedMessage` returns `true`. A console spy that has
 * `mockImplementation` takes its calls, so they do not reach the console. A message that comes when
 * no test runs goes to the console.
 */
export function failOnReportedMessages(): void {
  for (const method of consoleMethods) {
    // An assignment and not `vi.spyOn`: `vi.restoreAllMocks()` in a test removes a spy.
    console[method] = (...args: unknown[]) => {
      if (messages) {
        const text = `console.${method}: ${args.map(String).join(' ')}`;
        if (isReportedMessage(text, version)) {
          messages.push(text);
        }
      } else {
        originalConsole[method].apply(console, args);
      }
    };
  }

  beforeEach(() => {
    const list: string[] = [];
    messages = list;

    // Vitest runs the `onTestFinished` hooks in reverse order. This is the first one that the test
    // registers, so it runs last. It then sees a message of the unmount in the `afterEach` hook of
    // `createRenderer` and in the `onTestFinished` hook of `hydrate`.
    onTestFinished(() => {
      messages = undefined;
      if (list.length > 0) {
        throw new Error(
          `The test gave messages that it did not expect. To expect a Vue warning, assert the result of takeReportedMessages(). To expect a \`Vase UI:\` message, use a console spy that has mockImplementation.\n\n${list.join('\n')}`,
        );
      }
    });
  });
}

/**
 * Records the Vue warnings of the app. When a component is in the warning context, Vue gives the
 * warning to the `warnHandler` of its app and not to `console.warn`, so a console spy of a test
 * cannot hide it. Vue writes each other warning to `console.warn`.
 */
export function recordVueWarnings(app: App): void {
  // The handler never throws. After a `warnHandler` throws, Vue gives no more warnings on that page.
  app.config.warnHandler = (message, _instance, trace) => {
    const text = `Vue warning: ${message}${trace ? `\n${trace}` : ''}`;
    if (messages) {
      messages.push(text);
    } else {
      originalConsole.warn.call(console, text);
    }
  };
}

/**
 * Returns the messages of the current test until now, and removes them from the list that the check
 * at the end of the test reads. Outside a test it returns an empty list.
 */
export function takeReportedMessages(): string[] {
  return messages?.splice(0) ?? [];
}
