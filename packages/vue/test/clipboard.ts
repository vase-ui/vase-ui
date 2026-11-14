import { fireEvent } from './fireEvent';

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
