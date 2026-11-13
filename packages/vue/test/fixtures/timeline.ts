import { expect } from 'vitest';

// TEMPORARY. Measures the timing fault of two Collapsible.Panel tests in Firefox.
// This file is removed before the last push.

const EVENT_TYPES = [
  'transitionrun',
  'transitionstart',
  'transitionend',
  'transitioncancel',
  'animationstart',
  'animationend',
  'animationcancel',
];
const PANEL = '[data-testid="panel"]';
const ATTRIBUTES = [
  'data-closed',
  'data-open',
  'data-ending-style',
  'data-starting-style',
  'hidden',
];
const SLOW_MS = 40;

type Entry = [t: number, what: string];

let current: Timeline | undefined;

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function describeParent() {
  try {
    return `${window.parent.document.visibilityState}/${window.parent.document.hasFocus()}`;
  } catch {
    return 'unreadable';
  }
}

function describePage() {
  return `visibility=${document.visibilityState} focus=${document.hasFocus()} parent=${describeParent()}`;
}

class Timeline {
  readonly title = expect.getState().currentTestName ?? '';

  private readonly origin = performance.now();

  private readonly entries: Entry[] = [];

  private readonly frames: number[] = [];

  private readonly styles = new WeakMap<Element, string>();

  private readonly observer = new MutationObserver((records) => this.handleMutations(records));

  private lastFrame = performance.now();

  private lastBeat = performance.now();

  private maxFrameGap = 0;

  private maxBeatGap = 0;

  private frameId = 0;

  private beatId = 0;

  constructor() {
    this.mark(`start ${describePage()}`);
    for (const type of EVENT_TYPES) {
      document.addEventListener(type, this.handleEvent, true);
    }
    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES, 'style'],
    });
    this.frameId = requestAnimationFrame(this.handleFrame);
    this.beatId = window.setInterval(this.handleBeat, 10);
  }

  mark(what: string) {
    this.entries.push([round(performance.now() - this.origin), what]);
  }

  private handleFrame = () => {
    const now = performance.now();
    const gap = now - this.lastFrame;
    this.lastFrame = now;
    this.maxFrameGap = Math.max(this.maxFrameGap, gap);
    this.frames.push(round(now - this.origin));
    if (gap > SLOW_MS) {
      this.mark(`slow frame gap=${round(gap)}`);
    }
    this.frameId = requestAnimationFrame(this.handleFrame);
  };

  private handleBeat = () => {
    const now = performance.now();
    const gap = now - this.lastBeat;
    this.lastBeat = now;
    this.maxBeatGap = Math.max(this.maxBeatGap, gap);
    if (gap > SLOW_MS) {
      this.mark(`slow timer gap=${round(gap)}`);
    }
  };

  private handleEvent = (event: Event) => {
    const target = event.target as Element | null;
    if (!target?.matches?.(PANEL)) {
      return;
    }
    this.mark(describeEvent(event, this.origin));
  };

  private handleMutations(records: MutationRecord[]) {
    for (const record of records) {
      if (record.type === 'attributes') {
        const target = record.target as Element;
        if (!target.matches(PANEL)) {
          continue;
        }
        const name = record.attributeName!;
        const value = target.getAttribute(name);
        if (name === 'style') {
          if (value !== this.styles.get(target)) {
            this.styles.set(target, value ?? '');
            this.mark(`style ${JSON.stringify(value)}`);
          }
        } else {
          this.mark(`attribute ${name} ${value === null ? 'removed' : JSON.stringify(value)}`);
        }
        continue;
      }
      for (const node of record.removedNodes) {
        const panel =
          node instanceof Element ? (node.matches(PANEL) ? node : node.querySelector(PANEL)) : null;
        if (panel) {
          this.mark('panel removed');
          // A removed element gets its cancel events itself, not through the document.
          for (const type of EVENT_TYPES) {
            panel.addEventListener(type, this.handleDetachedEvent);
          }
        }
      }
      for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches(PANEL) || node.querySelector(PANEL))) {
          this.mark('panel added');
        }
      }
    }
  }

  private handleDetachedEvent = (event: Event) => {
    this.mark(`detached ${describeEvent(event, this.origin)}`);
  };

  finish(result: 'pass' | 'fail') {
    this.mark(`end ${describePage()}`);
    cancelAnimationFrame(this.frameId);
    clearInterval(this.beatId);
    this.observer.disconnect();
    for (const type of EVENT_TYPES) {
      document.removeEventListener(type, this.handleEvent, true);
    }
    return JSON.stringify({
      title: this.title,
      result,
      maxFrameGap: round(this.maxFrameGap),
      maxBeatGap: round(this.maxBeatGap),
      entries: this.entries,
      frames: this.frames,
    });
  }
}

function describeEvent(event: Event, origin: number) {
  const name =
    'propertyName' in event
      ? (event as TransitionEvent).propertyName
      : (event as AnimationEvent).animationName;
  const elapsed = (event as TransitionEvent | AnimationEvent).elapsedTime;
  return `${event.type} ${name} elapsed=${elapsed} stamp=${round(event.timeStamp - origin)}`;
}

export function mark(what: string) {
  current?.mark(what);
}

/**
 * Records a timeline while the test runs. It prints the timeline, and it adds the timeline to the
 * message of a failure.
 */
export function timed<Args extends unknown[]>(body: (...args: Args) => Promise<void>) {
  return async (...args: Args) => {
    const timeline = new Timeline();
    current = timeline;
    try {
      await body(...args);
      console.log(`TIMELINE ${timeline.finish('pass')}`);
    } catch (error) {
      const json = timeline.finish('fail');
      console.log(`TIMELINE ${json}`);
      if (error instanceof Error) {
        error.message += `\nTIMELINE ${json}`;
      }
      throw error;
    } finally {
      current = undefined;
    }
  };
}
