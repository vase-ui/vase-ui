// TEMPORARY PROBE of the WebKit hydration cases (page side). Not for commit.
// Marks wait in this buffer and go to Node with the next `renderOnServer` command.
interface Mark {
  name: string;
  at: number;
  [key: string]: unknown;
}

declare const __PROBE_HEARTBEAT__: boolean;

const marks: Mark[] = [];

export function mark(name: string, extra: Record<string, unknown> = {}) {
  marks.push({ name, at: Date.now(), ...extra });
}

export function takeMarks(): Mark[] {
  return marks.splice(0);
}

// A frame heartbeat of the page: each gap of 50 ms or more between two frames is a mark. A page
// that runs no task for a time (a collection, a long task) renders no frame in that time.
// The reference is the frame function of the browser: fake timers replace the global one.
if (typeof document !== 'undefined' && __PROBE_HEARTBEAT__) {
  const browserRequestAnimationFrame = globalThis.requestAnimationFrame;
  let lastFrame = performance.now();
  let frames = 0;
  const onFrame = (now: number) => {
    frames += 1;
    if (now - lastFrame >= 50) {
      mark('frame-gap', { ms: Math.round(now - lastFrame), frames });
    }
    lastFrame = now;
    browserRequestAnimationFrame(onFrame);
  };
  browserRequestAnimationFrame(onFrame);
}
