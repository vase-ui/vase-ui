import { onTestFinished } from 'vitest';

/**
 * Waits for the specified number of milliseconds.
 */
export async function wait(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Waits for a single animation frame.
 */
export async function waitSingleFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

/**
 * Resolves with the value of `read` `ms` milliseconds after the next `type` event of `target`. A
 * command of `userEvent` can take more time than a delay, so a wait that starts after the command
 * can end after the delay. The window gets the event in the capture phase, before the listeners of
 * the parts. A timer of `ms` or more that a part starts in that event or later runs after this one
 * (https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#run-steps-after-a-timeout).
 */
export function readAfter<T>(target: Element, type: string, ms: number, read: () => T) {
  return new Promise<T>((resolve) => {
    const remove = () => window.removeEventListener(type, listener, true);
    function listener(event: Event) {
      if (event.target !== target) return;
      remove();
      setTimeout(() => resolve(read()), ms);
    }
    window.addEventListener(type, listener, true);
    onTestFinished(remove);
  });
}

/**
 * Resolves with the value of `read` in the task of the first change of the DOM after which `ready`
 * gives `true`. A command of `userEvent` can end long after such a change, and a delay or a leave
 * that started at the change can end first. The callback of a `MutationObserver` runs in the task
 * of the change, after Vue rendered it.
 */
export function readWhen<T>(ready: () => boolean, read: () => T) {
  return new Promise<T>((resolve) => {
    const observer = new MutationObserver(() => {
      if (!ready()) return;
      observer.disconnect();
      resolve(read());
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true });
    onTestFinished(() => observer.disconnect());
  });
}
