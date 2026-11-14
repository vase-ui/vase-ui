// TEMPORARY PROBE of the hydration stall (browser side). Not for commit.
// Marks wait in this buffer and go to Node with the next `renderOnServer` command.
interface Mark { name: string; at: number; [key: string]: unknown }
const marks: Mark[] = [];
export function mark(name: string, extra: Record<string, unknown> = {}) {
  marks.push({ name, at: Date.now(), ...extra });
}
export function takeMarks(): Mark[] {
  return marks.splice(0);
}

// A heartbeat of the main thread: a timer and a frame callback. A gap of 150 ms or more is a mark.
if (typeof document !== 'undefined' && (globalThis as { __PROBE_HEARTBEAT__?: boolean }).__PROBE_HEARTBEAT__) {
  const realSetInterval = globalThis.setInterval;
  let lastTimer = performance.now();
  realSetInterval(() => {
    const now = performance.now();
    if (now - lastTimer >= 150) mark('timer-gap', { ms: Math.round(now - lastTimer) });
    lastTimer = now;
  }, 50);
  let lastFrame = performance.now();
  const onFrame = () => {
    const now = performance.now();
    if (now - lastFrame >= 150) mark('frame-gap', { ms: Math.round(now - lastFrame) });
    lastFrame = now;
    requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);
}
