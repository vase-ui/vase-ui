/** A step that `time.ts` times in the page. */
export type Action =
  /** Calls `window.startApp` of a page that has the URL parameter `manual`. */
  | { kind: 'start' }
  /** Calls `click()` of the trigger. */
  | { kind: 'click' }
  /** Dispatches a `keydown` of ArrowDown on the focused element. */
  | { kind: 'arrowDown' }
  /** Sets the value of the input of a Combobox and dispatches an `input` event. */
  | { kind: 'type'; text: string };

/** The state that ends a timed step. */
export type Condition =
  | { kind: 'instances'; count: number }
  | { kind: 'open' }
  | { kind: 'closed' }
  /** The active option is another option than at the start of the step. */
  | { kind: 'highlight' }
  | { kind: 'options'; count: number }
  /** The hydration page set `data-bench-hydrated` on the root element. */
  | { kind: 'hydrated' };

export interface Driver {
  /** The milliseconds from the action to the first check, after the frame of the action, that finds the condition. */
  measure: (action: Action, condition: Condition) => Promise<number>;
  /** Times the next `keydown` event of the page, from the event to the first check that finds the condition. */
  measureNextKeydown: (condition: Condition) => void;
  /** The result of the last call of `measureNextKeydown`. */
  keydownMeasure: () => Promise<number>;
  /** Waits for two frames, so that the work of the last step is done. */
  nextFrames: () => Promise<void>;
  /** Focuses the trigger or the input of the scenario, then waits for two frames. */
  focus: (target: 'trigger' | 'input') => Promise<void>;
  isOpen: () => boolean;
}

declare global {
  interface Window {
    benchmarkDriver: Driver;
  }
}

/**
 * Adds `window.benchmarkDriver` to the page. Playwright runs the source of this function in the
 * page before the scripts of the page, so the function uses nothing from outside its body.
 *
 * A step starts in a frame callback, as in Speedometer 3. The check runs in a timer after the
 * callback, so it comes after the style, layout and paint work of that frame.
 */
export function installDriver(): void {
  const TIMEOUT = 5000;

  const element = (marker: string): HTMLElement | null =>
    document.querySelector<HTMLElement>(`[data-bench="${marker}"]`);

  const visiblePopup = (): Element | undefined =>
    Array.from(document.querySelectorAll('[data-bench="popup"]')).find((popup) =>
      popup.checkVisibility(),
    );

  const activeOption = (): Element | null => {
    const focused = document.activeElement;
    const id = focused?.getAttribute('aria-activedescendant');
    if (id) {
      return document.getElementById(id);
    }
    return focused?.getAttribute('role') === 'option' ? focused : null;
  };

  /** Returns the check of a condition. A check that compares with the start reads the start now. */
  const checkOf = (condition: Condition): (() => boolean) => {
    switch (condition.kind) {
      case 'instances':
        return () =>
          document.querySelectorAll('[data-bench="instance"]').length === condition.count;
      case 'open':
        return () => visiblePopup() !== undefined;
      case 'closed':
        return () => visiblePopup() === undefined;
      case 'highlight': {
        const start = activeOption();
        return () => {
          const active = activeOption();
          return active !== null && active !== start;
        };
      }
      case 'options':
        return () =>
          Array.from(visiblePopup()?.querySelectorAll('[role="option"]') ?? []).filter((option) =>
            option.checkVisibility(),
          ).length === condition.count;
      case 'hydrated':
        return () => 'benchHydrated' in document.documentElement.dataset;
    }
  };

  const describe = (condition: Condition): string =>
    'count' in condition ? `${condition.kind} ${String(condition.count)}` : condition.kind;

  /** Returns the check of a condition that does not hold yet, so that a step changes the state. */
  const startCheckOf = (condition: Condition): (() => boolean) => {
    const isDone = checkOf(condition);
    if (isDone()) {
      throw new Error(`The "${describe(condition)}" state holds before the step.`);
    }
    return isDone;
  };

  /** Returns the action with its target found, so that the search is not timed. */
  const actionOf = (action: Action): (() => void) => {
    switch (action.kind) {
      case 'start': {
        const { startApp } = window;
        if (startApp === undefined) {
          throw new Error('The page has no startApp. Open it with the URL parameter "manual".');
        }
        return startApp;
      }
      case 'click': {
        const trigger = element('trigger');
        if (trigger === null) {
          throw new Error('The page has no trigger.');
        }
        return () => {
          trigger.click();
        };
      }
      case 'arrowDown': {
        const target = document.activeElement ?? document.body;
        return () => {
          target.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'ArrowDown',
              code: 'ArrowDown',
              bubbles: true,
              cancelable: true,
              composed: true,
            }),
          );
        };
      }
      case 'type': {
        const input = element('input');
        if (!(input instanceof HTMLInputElement)) {
          throw new Error('The page has no input.');
        }
        return () => {
          // The setter of the prototype, as a person who types: React tracks the setter of the element.
          Reflect.set(HTMLInputElement.prototype, 'value', action.text, input);
          input.dispatchEvent(
            new InputEvent('input', { bubbles: true, inputType: 'insertText', data: action.text }),
          );
        };
      }
    }
  };

  /** Checks in a timer after the current task, then once after each frame, until the condition. */
  const check = (start: number, condition: Condition, isDone: () => boolean): Promise<number> =>
    new Promise((resolve, reject) => {
      const run = () => {
        // A forced layout counts the layout of the step also when the page renders no frame.
        document.body.getBoundingClientRect();
        if (isDone()) {
          resolve(performance.now() - start);
        } else if (performance.now() - start > TIMEOUT) {
          reject(
            new Error(`No "${describe(condition)}" state ${String(TIMEOUT)} ms after the step.`),
          );
        } else {
          requestAnimationFrame(() => setTimeout(run, 0));
        }
      };
      setTimeout(run, 0);
    });

  const nextFrames = (): Promise<void> =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });

  let keydownMeasure: Promise<number> | undefined;

  window.benchmarkDriver = {
    measure: (action, condition) =>
      new Promise((resolve, reject) => {
        requestAnimationFrame(() => {
          try {
            const isDone = startCheckOf(condition);
            const run = actionOf(action);
            const start = performance.now();
            run();
            check(start, condition, isDone).then(resolve, reject);
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      }),
    measureNextKeydown: (condition) => {
      const isDone = startCheckOf(condition);
      keydownMeasure = new Promise((resolve, reject) => {
        window.addEventListener(
          'keydown',
          () => {
            check(performance.now(), condition, isDone).then(resolve, reject);
          },
          { capture: true, once: true },
        );
      });
    },
    keydownMeasure: () => keydownMeasure ?? Promise.reject(new Error('No keydown was measured.')),
    nextFrames,
    focus: (target) => {
      const found = element(target);
      if (found === null) {
        return Promise.reject(new Error(`The page has no ${target}.`));
      }
      if (document.activeElement !== found) {
        found.focus();
      }
      return nextFrames();
    },
    isOpen: () => visiblePopup() !== undefined,
  };
}
