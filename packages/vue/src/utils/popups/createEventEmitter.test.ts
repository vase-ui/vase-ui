import { describe, expect, it, vi } from 'vitest';
import { createEventEmitter } from './createEventEmitter';

describe('createEventEmitter', () => {
  it('calls each listener of the event with the data and no listener of another event', () => {
    const emitter = createEventEmitter();
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();
    emitter.on('open', first);
    emitter.on('open', second);
    emitter.on('close', other);

    emitter.emit('open', { reason: 'trigger-press' });

    expect(first).toHaveBeenCalledExactlyOnceWith({ reason: 'trigger-press' });
    expect(second).toHaveBeenCalledExactlyOnceWith({ reason: 'trigger-press' });
    expect(other).not.toHaveBeenCalled();
  });

  it('removes one listener with off and keeps the others', () => {
    const emitter = createEventEmitter();
    const removed = vi.fn();
    const kept = vi.fn();
    emitter.on('open', removed);
    emitter.on('open', kept);

    emitter.off('open', removed);
    emitter.emit('open', 1);

    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledExactlyOnceWith(1);
  });
});
