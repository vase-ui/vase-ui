import type { BrowserCommand } from 'vitest/node';

let owner = 0;
let nextToken = 0;
const waiters: (() => void)[] = [];

/**
 * Claims the one clipboard of the browser process. Parallel test files in Chromium and WebKit
 * share that clipboard across browser contexts.
 */
export const lockClipboard: BrowserCommand = async () => {
  if (owner !== 0) {
    await new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
  }
  nextToken += 1;
  owner = nextToken;
  return nextToken;
};

/** Releases the clipboard when `token` still holds it. */
export const unlockClipboard: BrowserCommand<[token: number]> = (_context, token) => {
  if (owner !== token) return;
  const next = waiters.shift();
  if (next) {
    // Keep the lock until the next caller takes its token, and invalidate `token`.
    owner = -1;
    next();
  } else {
    owner = 0;
  }
};
