import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { screen, waitFor, waitSingleFrame, within } from '#test-utils';

const WAIT_FRAMES = 180;

/** Counts the frames of the page from the call. */
function countFrames() {
  const counter = { frames: 0 };
  let request = requestAnimationFrame(function count() {
    counter.frames += 1;
    request = requestAnimationFrame(count);
  });
  onTestFinished(() => {
    cancelAnimationFrame(request);
  });
  return counter;
}

/** Calls `callback` in the frame that comes `frames` frames after the call. */
function afterFrames(frames: number, callback: () => void) {
  requestAnimationFrame(() => {
    if (frames === 1) {
      callback();
    } else {
      afterFrames(frames - 1, callback);
    }
  });
}

/** Blocks the page in a timer task. The page renders no frame during that time. */
function stallPage(milliseconds: number) {
  setTimeout(() => {
    const end = performance.now() + milliseconds;
    while (performance.now() < end) {
      // The loop holds the main thread.
    }
  });
}

function appendButton(name: string) {
  const button = document.createElement('button');
  button.textContent = name;
  document.body.append(button);
  onTestFinished(() => {
    button.remove();
  });
  return button;
}

describe('waitFor', () => {
  it('resolves with the result of the first call when that call passes', async () => {
    const callback = vi.fn(() => 'result');

    await expect(waitFor(callback)).resolves.toBe('result');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      change: 'an added element',
      prepareChange: () => () => {
        appendButton('Changed');
      },
    },
    {
      change: 'a changed attribute',
      prepareChange: () => {
        const button = appendButton('Changed');
        button.hidden = true;
        return () => {
          button.hidden = false;
        };
      },
    },
    {
      change: 'a changed text',
      prepareChange: () => {
        const button = appendButton('Original');
        return () => {
          button.firstChild!.nodeValue = 'Changed';
        };
      },
    },
  ])('calls the callback again after $change, before the next frame', async ({ prepareChange }) => {
    const change = prepareChange();
    const counter = countFrames();
    queueMicrotask(change);

    const button = await waitFor(() => screen.getByRole('button', { name: 'Changed' }));

    expect(button).toHaveTextContent('Changed');
    expect(counter.frames).toBe(0);
  });

  it('calls the callback again in each frame, with no change of the DOM', async () => {
    let isDone = false;
    afterFrames(3, () => {
      isDone = true;
    });

    await waitFor(() => {
      expect(isDone).toBe(true);
    });
  });

  it('rejects with the last error of the callback after 180 frames of the page', async () => {
    const counter = countFrames();
    let calls = 0;

    const error: unknown = await waitFor(() => {
      calls += 1;
      throw new Error(`call ${calls}`);
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    const { message } = error as Error;
    expect(message.startsWith(`call ${calls}\n`)).toBe(true);
    expect(message).toContain('<body');
    expect(counter.frames).toBe(WAIT_FRAMES);
  });

  it('adds the DOM to an error whose message has only a getter', async () => {
    const error: unknown = await waitFor(() => {
      document.querySelector('<');
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).message).toContain('<body');
  });

  it('gives the role report only in the last call', async () => {
    const firstLines: string[] = [];

    await expect(
      waitFor(() => {
        try {
          screen.getByRole('button', { name: 'Absent' });
        } catch (error) {
          firstLines.push((error as Error).message.split('\n')[0]);
          throw error;
        }
      }),
    ).rejects.toThrow('Unable to find an accessible element');

    expect(new Set(firstLines.slice(0, -1))).toEqual(
      new Set(['Unable to find role="button" and name "Absent"']),
    );
    expect(firstLines.at(-1)).toMatch(/^Unable to find an accessible element/);
  });

  it('refuses a callback that returns a promise', async () => {
    const callback = vi.fn(() => Promise.resolve('result'));

    const error: unknown = await waitFor(callback).catch((reason: unknown) => reason);
    await waitSingleFrame();

    expect(error).toBeInstanceOf(TypeError);
    expect((error as TypeError).message).toContain('returned a promise');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not count the time of a stall of the page', async () => {
    let isDone = false;
    afterFrames(5, () => {
      isDone = true;
    });
    // Longer than the limit of 1 s of the wait of Testing Library.
    stallPage(1200);

    await waitFor(() => {
      expect(isDone).toBe(true);
    });
  });

  it('counts frames of the browser under fake timers', async () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    let isDone = false;
    // Fake timers do not fake `MessageChannel`.
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      isDone = true;
    };
    channel.port2.postMessage(null);

    await waitFor(() => {
      expect(isDone).toBe(true);
    });
  });
});

describe('findBy queries', () => {
  it('finds an element that comes after a stall of the page', async () => {
    afterFrames(5, () => {
      appendButton('Late');
    });
    stallPage(1200);

    expect(await screen.findByRole('button', { name: 'Late' })).toHaveTextContent('Late');
  });

  it('refuses options for its wait', () => {
    expect(() => screen.findByRole('button', {}, { timeout: 5000 })).toThrow(
      'A `findBy` query of the test helpers takes no options for its wait.',
    );
  });

  it('rejects with the error of the query and the stack of the call after 180 frames', async () => {
    const counter = countFrames();

    const error: unknown = await within(document.body)
      .findByRole('button', { name: 'Absent' })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    const { message, stack } = error as Error;
    expect(message).toContain(
      'Unable to find an accessible element with the role "button" and name "Absent"',
    );
    // The error of the query has the DOM, and the wait does not add it a second time.
    expect(message.match(/Ignored nodes/g)).toHaveLength(1);
    expect(stack).toContain('waitFor.test.tsx');
    expect(counter.frames).toBe(WAIT_FRAMES);
  });
});
