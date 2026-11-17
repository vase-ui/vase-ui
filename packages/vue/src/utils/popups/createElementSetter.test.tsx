import { describe, expect, it, onTestFinished } from 'vitest';
import { createApp, defineComponent, shallowRef } from 'vue';
import {
  createHeldBranch,
  createRenderer,
  flushMicrotasks,
  installPartsInterop,
  screen,
} from '#test-utils';
import { createTestPopupStore } from '../../../test/popupStoreTestUtils';
import { recordVueWarnings } from '../../../test/reportedMessages';
import { createElementSetter, popupElementTarget, stateElementTarget } from './createElementSetter';
import type { ElementTarget } from './createElementSetter';

describe('createElementSetter', () => {
  const { render } = createRenderer();

  function createPart(
    target: ElementTarget,
    { isSpan = shallowRef(false), keepWhileHeld = false } = {},
  ) {
    return defineComponent(() => {
      const ref = createElementSetter(target, { keepWhileHeld });
      return () =>
        isSpan.value ? <span data-testid="part" ref={ref} /> : <div data-testid="part" ref={ref} />;
    });
  }

  function createPartInBranch({ mounted = true, keepWhileHeld = false } = {}) {
    const isSpan = shallowRef(false);
    const element = shallowRef<HTMLElement | null>(null);
    const Part = createPart(element, { isSpan, keepWhileHeld });
    const branch = createHeldBranch(() => <Part />, { renderBranch: (part) => part, mounted });
    return { ...branch, Part, isSpan, element };
  }

  it('writes the element of its part, and clears it when its part goes away', async () => {
    const element = shallowRef<HTMLElement | null>(null);
    const Part = createPart(element);
    const { unmount } = await render(<Part />);
    expect(element.value).toBe(screen.getByTestId('part'));

    unmount();

    expect(element.value).toBe(null);
  });

  it('keeps the element of a part that replaced its part', async () => {
    const element = shallowRef<HTMLElement | null>(null);
    const Part = createPart(element);
    const { rerender } = await render(
      <div>
        <Part key="old" />
      </div>,
    );
    expect(element.value).toBe(screen.getByTestId('part'));

    await rerender(
      <div>
        <Part key="old" />
        <Part key="new" data-testid="new" />
      </div>,
    );
    const replacement = screen.getByTestId('new');
    expect(element.value).toBe(replacement);

    await rerender(
      <div>
        <Part key="new" data-testid="new" />
      </div>,
    );

    expect(element.value).toBe(replacement);
  });

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
    const app = installPartsInterop(createApp({ render: () => <HeldBranch /> }));
    recordVueWarnings(app);
    app.mount(container);
    onTestFinished(() => app.unmount());
    await flushMicrotasks();

    expect(element.value).toBe(container.querySelector('[data-testid="part"]'));
    expect(element.value).not.toBe(null);
  });

  it('keeps the element while KeepAlive holds the part with keepWhileHeld', async () => {
    const { HeldBranch, hide, mountWhileHeld, show, element } = createPartInBranch({
      mounted: false,
      keepWhileHeld: true,
    });
    await render(<HeldBranch />);
    await mountWhileHeld();

    const part = element.value;
    expect(part?.dataset.testid).toBe('part');
    expect(part?.isConnected).toBe(false);

    await show();
    expect(screen.getByTestId('part')).toBe(part);
    await hide();

    expect(part?.isConnected).toBe(false);
    expect(element.value).toBe(part);
  });

  it('does not clear the element of a part that replaced its part when KeepAlive holds the old part', async () => {
    const { HeldBranch, Part, hide, element } = createPartInBranch();
    const { rerender } = await render(
      <div>
        <HeldBranch />
      </div>,
    );
    expect(element.value).toBe(screen.getByTestId('part'));

    await rerender(
      <div>
        <HeldBranch />
        <Part data-testid="new" />
      </div>,
    );
    const replacement = screen.getByTestId('new');
    expect(element.value).toBe(replacement);

    await hide();

    expect(screen.queryByTestId('part')).toBe(null);
    expect(element.value).toBe(replacement);
  });

  it('writes and clears the store key of a state element target', async () => {
    const store = createTestPopupStore();
    const Part = createPart(stateElementTarget(store, 'positionerElement'));
    const { unmount } = await render(<Part />);
    expect(store.state.positionerElement).toBe(screen.getByTestId('part'));

    unmount();

    expect(store.state.positionerElement).toBe(null);
  });

  it('writes and clears the popup ref and the popup element of the store', async () => {
    const store = createTestPopupStore();
    const Part = createPart(popupElementTarget(store));
    const { unmount } = await render(<Part />);
    const part = screen.getByTestId('part');
    expect(store.context.popupRef.value).toBe(part);
    expect(store.state.popupElement).toBe(part);

    unmount();

    expect(store.context.popupRef.value).toBe(null);
    expect(store.state.popupElement).toBe(null);
  });
});
