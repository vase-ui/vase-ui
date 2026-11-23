/** One element of a marker in one frame. */
export interface ElementSample {
  /** A number that stays with the element while the page is open. */
  id: number;
  visible: boolean;
  /** The opacity that the element shows: the product of its opacity and of each ancestor. */
  opacity: number;
  rect: { x: number; y: number; width: number; height: number };
}

export interface Frame {
  /** The time of the frame, from `performance.now()`. */
  time: number;
  /** The elements of each marker, such as `dialog-1`, in document order. */
  elements: Record<string, ElementSample[]>;
  /** For each marker, whether the focus is on an element of the marker or in it. */
  focus: Record<string, boolean>;
  /**
   * For each marker, whether the focus is in the dialog that holds an element of the marker: the
   * nearest element with the dialog role, from the element up.
   */
  focusInLayer: Record<string, boolean>;
  /** The `data-bench` marker of the focused element or of an ancestor, else its tag name. */
  active: string;
}

/** An input of the page: the event type and the time of the event. */
export interface Input {
  type: string;
  time: number;
}

export interface Recording {
  frames: Frame[];
  inputs: Input[];
}

export interface Recorder {
  /** Reads the markers now. */
  read: (markers: readonly string[]) => Frame;
  /** Reads the markers in the next frame. */
  nextFrame: (markers: readonly string[]) => Promise<Frame>;
  /**
   * Reads the markers in each frame, and keeps the time of each key press, pointer press and
   * pointer release.
   */
  start: (markers: readonly string[]) => void;
  stop: () => Recording;
}

declare global {
  interface Window {
    behaviorRecorder: Recorder;
  }
}

/**
 * Adds `window.behaviorRecorder` to the page. Playwright runs the source of this function in the
 * page before the scripts of the page, so the function uses nothing from outside its body.
 *
 * A frame callback runs after the browser updates the animations of the frame, so a computed style
 * that it reads is the style that the frame shows.
 */
export function installRecorder(): void {
  const LAYER = '[role="dialog"], [role="alertdialog"], dialog';
  const INPUT_TYPES = ['keydown', 'pointerdown', 'pointerup'];
  const ids = new WeakMap<Element, number>();
  let nextId = 0;

  const elementsOf = (marker: string): Element[] =>
    Array.from(document.querySelectorAll(`[data-bench="${marker}"]`));

  const shownOpacity = (element: Element): number => {
    let opacity = 1;
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  };

  const sample = (element: Element) => {
    let id = ids.get(element);
    if (id === undefined) {
      id = nextId++;
      ids.set(element, id);
    }
    const { x, y, width, height } = element.getBoundingClientRect();
    return {
      id,
      visible: element.isConnected && element.checkVisibility({ visibilityProperty: true }),
      opacity: shownOpacity(element),
      rect: { x, y, width, height },
    };
  };

  const describe = (element: Element | null): string => {
    const marked = element?.closest('[data-bench]');
    return marked?.getAttribute('data-bench') ?? element?.tagName.toLowerCase() ?? 'none';
  };

  const read = (markers: readonly string[]): Frame => {
    const active = document.activeElement;
    const frame: Frame = {
      time: performance.now(),
      elements: {},
      focus: {},
      focusInLayer: {},
      active: describe(active),
    };
    for (const marker of markers) {
      const elements = elementsOf(marker);
      frame.elements[marker] = elements.map(sample);
      frame.focus[marker] = active !== null && elements.some((element) => element.contains(active));
      frame.focusInLayer[marker] =
        active !== null &&
        elements.some((element) => (element.closest(LAYER) ?? element).contains(active));
    }
    return frame;
  };

  let recording: Recording = { frames: [], inputs: [] };
  let frameRequest: number | undefined;
  const keepInput = (event: Event) => {
    recording.inputs.push({ type: event.type, time: event.timeStamp });
  };

  window.behaviorRecorder = {
    read,
    nextFrame: (markers) =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve(read(markers));
        });
      }),
    start: (markers) => {
      recording = { frames: [], inputs: [] };
      for (const type of INPUT_TYPES) {
        window.addEventListener(type, keepInput, { capture: true });
      }
      const record = () => {
        recording.frames.push(read(markers));
        frameRequest = requestAnimationFrame(record);
      };
      frameRequest = requestAnimationFrame(record);
    },
    stop: () => {
      if (frameRequest !== undefined) {
        cancelAnimationFrame(frameRequest);
      }
      for (const type of INPUT_TYPES) {
        window.removeEventListener(type, keepInput, { capture: true });
      }
      return recording;
    },
  };
}
