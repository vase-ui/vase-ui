import { within } from '@testing-library/dom';
import type { BoundFunctions, queries } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { createApp, nextTick, shallowRef } from 'vue';
import type { VNode } from 'vue';
import { cloneElement } from './cloneElement';
import { recordVueWarnings } from './reportedMessages';

/**
 * A vnode, or a function that returns a vnode. A vnode that has a `ref` must be made in a render
 * function, so a test that sets a `ref` passes a function: `render(() => <Part ref={ref} />)`.
 */
export type Renderable = VNode | (() => VNode);

export type VaseUIRenderResult = BoundFunctions<typeof queries> & {
  container: HTMLElement;
  unmount: () => void;
  user: ReturnType<typeof userEvent.setup>;
  rerender: (element: Renderable) => Promise<void>;
  setProps: (props: Record<string, unknown>) => Promise<void>;
};

// Vue stamps an event with `Date.now()` in the first listener that gets it. It skips each later
// listener that was attached in that millisecond or after it. An event that comes right after a
// mount would lose its bubble listener.
async function waitForLaterMillisecond() {
  if (vi.isFakeTimers()) {
    // The fake clock does not move by itself, so the loop below would not end.
    vi.setSystemTime(Date.now() + 1);
    return;
  }
  const start = Date.now();
  while (Date.now() === start) {
    await Promise.resolve();
  }
}

export function createRenderer() {
  const mounted: { unmount: () => void; container: HTMLElement }[] = [];

  afterEach(() => {
    for (const { unmount, container } of mounted.splice(0)) {
      unmount();
      container.remove();
    }
  });

  async function render(element: Renderable): Promise<VaseUIRenderResult> {
    const current = shallowRef(element);
    const app = createApp({
      render: () => (typeof current.value === 'function' ? current.value() : current.value),
    });
    recordVueWarnings(app);
    const container = document.createElement('div');
    document.body.append(container);
    app.mount(container);

    let isMounted = true;
    function unmount() {
      if (isMounted) {
        isMounted = false;
        app.unmount();
      }
    }
    mounted.push({ unmount, container });

    await nextTick();
    await waitForLaterMillisecond();

    async function rerender(newElement: Renderable) {
      current.value = newElement;
      await nextTick();
      await waitForLaterMillisecond();
    }

    async function setProps(props: Record<string, unknown>) {
      await rerender(
        typeof element === 'function'
          ? () => cloneElement(element(), props)
          : cloneElement(element, props),
      );
    }

    return {
      ...within(document.body),
      container,
      unmount,
      user: userEvent.setup({ document }),
      rerender,
      setProps,
    };
  }

  return { render };
}
