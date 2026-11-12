/**
 * Resolves in the next task. At a task boundary the microtask queue is empty, so each flush of Vue
 * is done. This includes a flush that a part queues after its own `await nextTick()`.
 * Fake timers do not fake `MessageChannel`.
 */
export function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}
