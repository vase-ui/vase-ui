import { describe, expect, it } from 'vitest';
import { getDelay, getRestMs, isClickLikeOpenEvent, isHoverOpenEvent } from './useHoverShared';

describe('getDelay', () => {
  it('gives a number for the open delay and for the close delay', () => {
    expect(getDelay(300, 'open')).toBe(300);
    expect(getDelay(300, 'close')).toBe(300);
  });

  it('gives one key of an object, and nothing for a key that the object does not have', () => {
    expect(getDelay({ open: 100, close: 200 }, 'open')).toBe(100);
    expect(getDelay({ open: 100, close: 200 }, 'close')).toBe(200);
    expect(getDelay({ close: 200 }, 'open')).toBe(undefined);
  });

  it('calls a function at the time of the read', () => {
    let delay = 100;
    const read = () => delay;

    expect(getDelay(read, 'open')).toBe(100);
    delay = 400;

    expect(getDelay(read, 'open')).toBe(400);
  });

  it.each([
    { name: 'touch', pointerType: 'touch', expected: 0 },
    { name: 'pen', pointerType: 'pen', expected: 300 },
    { name: 'mouse', pointerType: 'mouse', expected: 300 },
    { name: 'an empty pointer type', pointerType: '', expected: 300 },
  ])('gives $expected for a delay of 300 and $name', ({ pointerType, expected }) => {
    expect(getDelay(300, 'open', pointerType)).toBe(expected);
  });
});

describe('getRestMs', () => {
  it('gives a number, and calls a function', () => {
    expect(getRestMs(50)).toBe(50);
    expect(getRestMs(() => 70)).toBe(70);
  });
});

describe('isHoverOpenEvent', () => {
  it.each([
    { name: 'mouseenter', type: 'mouseenter', expected: true },
    { name: 'mousemove', type: 'mousemove', expected: true },
    { name: 'mousedown', type: 'mousedown', expected: false },
    { name: 'click', type: 'click', expected: false },
    { name: 'focusin', type: 'focusin', expected: false },
  ])('is $expected for $name', ({ type, expected }) => {
    expect(Boolean(isHoverOpenEvent(type))).toBe(expected);
  });
});

describe('isClickLikeOpenEvent', () => {
  it('is true for a click, for a mousedown and after a press in the popup', () => {
    expect(isClickLikeOpenEvent('click', false)).toBe(true);
    expect(isClickLikeOpenEvent('mousedown', false)).toBe(true);
    expect(isClickLikeOpenEvent('mouseenter', false)).toBe(false);
    expect(isClickLikeOpenEvent('mouseenter', true)).toBe(true);
  });
});
