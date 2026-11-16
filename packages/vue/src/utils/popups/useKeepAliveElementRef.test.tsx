import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp, defineComponent, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { createHeldBranch, createRenderer, flushMicrotasks, screen } from '#test-utils';
import { recordVueWarnings } from '../../../test/reportedMessages';
import { useKeepAliveElementRef } from './useKeepAliveElementRef';

describe('useKeepAliveElementRef', () => {
  const { render } = createRenderer();

  // A part in a held branch. The part renders a `div` or a `span`, and gives its element to
  // `element`. `mounted` is whether the part mounts with the branch.
  function createPartInBranch({ mounted = true } = {}) {
    const isSpan = shallowRef(false);
    const element: ShallowRef<HTMLElement | null> = shallowRef(null);
    const Part = defineComponent(() => {
      const setElement = useKeepAliveElementRef((value) => {
        element.value = value;
      });
      const ref = (value: unknown) => setElement(value as HTMLElement | null);
      return () =>
        isSpan.value ? (
          <span key="span" data-testid="part" ref={ref} />
        ) : (
          <div key="div" data-testid="part" ref={ref} />
        );
    });
    const { HeldBranch, hide, mountWhileHeld, show } = createHeldBranch(() => <Part />, {
      renderBranch: (part) => part,
      mounted,
    });
    return { HeldBranch, isSpan, hide, mountWhileHeld, show, element };
  }

  it('gives null while KeepAlive holds the part, and the element again at the activation', async () => {
    const { HeldBranch, hide, show, element } = createPartInBranch();
    await render(<HeldBranch />);
    const part = screen.getByTestId('part');
    expect(element.value).toBe(part);

    await hide();

    expect(part.isConnected).toBe(false);
    expect(element.value).toBe(null);

    await show();

    expect(part.isConnected).toBe(true);
    expect(element.value).toBe(part);
  });

  it('gives a new element that a render makes while KeepAlive holds the part only at the activation', async () => {
    const { HeldBranch, isSpan, hide, show, element } = createPartInBranch();
    await render(<HeldBranch />);

    await hide();
    isSpan.value = true;
    await flushMicrotasks();

    expect(element.value).toBe(null);

    await show();

    const part = screen.getByTestId('part');
    expect(part.tagName).toBe('SPAN');
    expect(element.value).toBe(part);
  });

  it('gives no element of a part that mounts while KeepAlive holds its branch until the activation', async () => {
    const { HeldBranch, mountWhileHeld, show, element } = createPartInBranch({
      mounted: false,
    });
    await render(<HeldBranch />);

    await mountWhileHeld();

    expect(screen.queryByTestId('part')).toBe(null);
    expect(element.value).toBe(null);

    await show();

    expect(element.value).toBe(screen.getByTestId('part'));
  });

  it('gives the element of a part of an app that mounts in a detached element', async () => {
    const { HeldBranch, element } = createPartInBranch();
    const container = document.createElement('div');
    const app = createApp({ render: () => <HeldBranch /> });
    recordVueWarnings(app);
    app.mount(container);
    onTestFinished(() => app.unmount());
    await flushMicrotasks();

    expect(element.value).toBe(container.querySelector('[data-testid="part"]'));
    expect(element.value).not.toBe(null);
  });
});
