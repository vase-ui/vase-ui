import { onTestFinished } from 'vitest';
import { commands } from 'vitest/browser';
import { fireEvent } from './fireEvent';

declare module 'vitest/browser' {
  interface BrowserCommands {
    lockClipboard: () => Promise<number>;
    unlockClipboard: (token: number) => Promise<void>;
  }
}

/**
 * Runs a real copy and paste under the clipboard lock of the browser process. Parallel test files
 * in Chromium and WebKit share one clipboard.
 */
export async function withClipboard<T>(action: () => Promise<T>): Promise<T> {
  const token = await commands.lockClipboard();
  onTestFinished(() => commands.unlockClipboard(token));
  try {
    return await action();
  } finally {
    await commands.unlockClipboard(token);
  }
}

/**
 * Dispatches a `paste` event carrying `value` as `text/plain`. `fireEvent.paste` cannot be used
 * because Chromium and WebKit refuse a plain object as its `clipboardData`.
 */
export function pasteText(target: HTMLElement, value: string) {
  const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(pasteEvent, 'clipboardData', {
    value: {
      getData: (type: string) => (type === 'text/plain' ? value : ''),
    },
  });

  return fireEvent(target, pasteEvent);
}
