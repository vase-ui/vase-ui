import { server } from 'vitest/browser';
import { expect, describe, it } from 'vitest';
import { platform } from './index';

describe('platform.engine', () => {
  it('names the engine that runs the test', () => {
    const { browser } = server;
    const { blink, gecko, webkit } = platform.engine;

    expect({ blink, gecko, webkit }).toEqual({
      blink: browser === 'chromium',
      gecko: browser === 'firefox',
      webkit: browser === 'webkit',
    });
  });
});
