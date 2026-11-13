import { expect } from 'vitest';

// TEMPORARY. Measures the timing fault of two Collapsible.Panel tests in Firefox.
// This file is removed before the last push.
//
// The timeline only watches. It does not request frames of its own and it sets no timer, so a page
// that was idle stays idle.

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
const CHUNK_LENGTH = 3000;

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

function describeEvent(event: Event, origin: number) {
  const name =
    'propertyName' in event
      ? (event as TransitionEvent).propertyName
      : (event as AnimationEvent).animationName;
  const elapsed = (event as TransitionEvent | AnimationEvent).elapsedTime;
  return `${event.type} ${name} elapsed=${elapsed} stamp=${round(event.timeStamp - origin)}`;
}

class Timeline {
  readonly title = expect.getState().currentTestName ?? '';

  private readonly origin = performance.now();

  private readonly entries: Entry[] = [];

  private readonly styles = new WeakMap<Element, string>();

  private readonly observer = new MutationObserver((records) => this.handleMutations(records));

  private readonly originalRequestAnimationFrame = window.requestAnimationFrame;

  private lastFrameRun: number | undefined;

  private maxFrameGap = 0;

  private maxFrameLatency = 0;

  private frameCount = 0;

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
    const original = this.originalRequestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      const requested = performance.now();
      return original.call(window, (time) => {
        const ran = performance.now();
        const latency = ran - requested;
        const gap = this.lastFrameRun === undefined ? 0 : ran - this.lastFrameRun;
        this.lastFrameRun = ran;
        this.frameCount += 1;
        this.maxFrameLatency = Math.max(this.maxFrameLatency, latency);
        this.maxFrameGap = Math.max(this.maxFrameGap, gap);
        this.mark(`frame latency=${round(latency)} gap=${round(gap)}`);
        callback(time);
      });
    };
  }

  mark(what: string) {
    this.entries.push([round(performance.now() - this.origin), what]);
  }

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
    window.requestAnimationFrame = this.originalRequestAnimationFrame;
    this.observer.disconnect();
    for (const type of EVENT_TYPES) {
      document.removeEventListener(type, this.handleEvent, true);
    }
    return {
      title: this.title,
      result,
      maxFrameGap: round(this.maxFrameGap),
      maxFrameLatency: round(this.maxFrameLatency),
      frameCount: this.frameCount,
      entries: this.entries,
    };
  }
}

export function mark(what: string) {
  current?.mark(what);
}

// Vitest cuts a long console line, so a timeline goes out in parts of 3000 characters.
function print(summary: ReturnType<Timeline['finish']>) {
  const json = JSON.stringify(summary);
  const id = Math.random().toString(36).slice(2, 8);
  const count = Math.ceil(json.length / CHUNK_LENGTH);
  for (let index = 0; index < count; index += 1) {
    const chunk = json.slice(index * CHUNK_LENGTH, (index + 1) * CHUNK_LENGTH);
    console.log(`TIMELINE ${id} ${index + 1}/${count} ${chunk}`);
  }
}

/**
 * Records a timeline while the test runs. It prints the timeline, and it adds the end of the
 * timeline to the message of a failure.
 */
export function timed<Args extends unknown[]>(body: (...args: Args) => Promise<void>) {
  return async (...args: Args) => {
    const timeline = new Timeline();
    current = timeline;
    try {
      await body(...args);
      print(timeline.finish('pass'));
    } catch (error) {
      const summary = timeline.finish('fail');
      print(summary);
      if (error instanceof Error) {
        const tail = summary.entries.slice(-60).map(([t, what]) => `${t} ${what}`);
        error.message += `\nTIMELINE (last ${tail.length} entries)\n${tail.join('\n')}`;
      }
      throw error;
    } finally {
      current = undefined;
    }
  };
}
