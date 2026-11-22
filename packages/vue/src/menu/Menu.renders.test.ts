import { describe, expect, inject, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import MenuRenders from '../../test/fixtures/MenuRenders.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

// The counts are renders of the virtual DOM: a Vapor component updates each binding alone.

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

/** Counts the renders of each part, and the `MutationObserver` objects that the page makes. */
function counter() {
  const renders: Record<string, number> = {};
  let observers = 0;
  let counts = false;
  const Native = window.MutationObserver;
  window.MutationObserver = class extends Native {
    constructor(callback: MutationCallback) {
      super(callback);
      if (counts) observers += 1;
    }
  };
  onTestFinished(() => {
    window.MutationObserver = Native;
  });
  return {
    renders,
    observers: () => observers,
    /** Counts the observers while the function runs. */
    async during(run: () => Promise<void>) {
      counts = true;
      await run();
      counts = false;
    },
    count(part: string) {
      renders[part] = (renders[part] ?? 0) + 1;
      return '';
    },
  };
}

describe.runIf(inject('app') === 'vdom')('the work of an open', () => {
  test('a key on the trigger renders each part only for a change, and makes no observer for a fieldset that is not there', async () => {
    const spy = counter();
    mount(MenuRenders, { count: spy.count });
    await nextTick();
    document.querySelector<HTMLElement>('[data-testid="trigger"]')!.focus();
    await spy.during(() => userEvent.keyboard('{ArrowDown}'));
    await waitFor(() => expect(document.activeElement).toHaveTextContent('Item 1'));
    for (let frame = 0; frame < 3; frame += 1) await nextFrame();
    // The positioner renders at its mount, for its element, for the size variables and for the
    // place. The first frames give no other place. The portal renders at the open, for the popup
    // and for the hole of its fixed element at the trigger. Each item renders once, and the first
    // item once more for its highlight.
    expect(spy.renders).toEqual({ portal: 3, positioner: 4, item: 6 });
    // The observer of the layer for a move to another root, and that of the focus. An item with
    // no fieldset around it watches no fieldset.
    expect(spy.observers()).toBe(2);
  });
});
