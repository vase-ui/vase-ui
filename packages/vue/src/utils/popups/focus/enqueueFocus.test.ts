import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { enqueueFocus } from './enqueueFocus';

function appendButtons() {
  const first = document.createElement('button');
  const second = document.createElement('button');
  document.body.append(first, second);
  onTestFinished(() => {
    first.remove();
    second.remove();
  });
  return [first, second];
}

function holdAnimationFrames() {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  return () => frames.splice(0).forEach((callback) => callback(0));
}

describe('enqueueFocus', () => {
  it('moves the focus in the next frame, with preventScroll', () => {
    const [first] = appendButtons();
    const focus = vi.spyOn(first, 'focus');
    const runFrames = holdAnimationFrames();

    enqueueFocus(first, { preventScroll: true });
    expect(first).not.toHaveFocus();
    runFrames();

    expect(first).toHaveFocus();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('moves the focus at once with sync', () => {
    const [first] = appendButtons();
    holdAnimationFrames();

    enqueueFocus(first, { sync: true });

    expect(first).toHaveFocus();
  });

  it('lets a later call replace a call that waits for its frame', () => {
    const [first, second] = appendButtons();
    const focus = vi.spyOn(first, 'focus');
    const runFrames = holdAnimationFrames();

    enqueueFocus(first);
    enqueueFocus(second);
    runFrames();

    expect(second).toHaveFocus();
    expect(focus).not.toHaveBeenCalled();
  });

  it('moves no focus when shouldFocus returns false in the frame', () => {
    const [first] = appendButtons();
    const runFrames = holdAnimationFrames();

    enqueueFocus(first, { shouldFocus: () => false });
    runFrames();

    expect(first).not.toHaveFocus();
  });

  it('moves no focus after the function that it returns is called', () => {
    const [first] = appendButtons();
    const runFrames = holdAnimationFrames();

    const cancel = enqueueFocus(first);
    cancel();
    runFrames();

    expect(first).not.toHaveFocus();
  });
});
