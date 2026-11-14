import { describe, expect, it, onTestFinished } from 'vitest';
import { KeepAlive, createApp, defineComponent, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { recordVueWarnings } from '../../../test/reportedMessages';
import { useKeepAliveElementRef } from './useKeepAliveElementRef';

describe('useKeepAliveElementRef', () => {
  const { render } = createRenderer();

  // A trigger and a part in a `KeepAlive`. The part renders a `div` or a `span`, and gives its
  // element to `element`. `hasPart` adds the part to the branch.
  function createTriggerAndPart() {
    const isSpan = shallowRef(false);
    const hasPart = shallowRef(true);
    const visible = shallowRef(true);
    const trigger = shallowRef<HTMLElement | null>(null);
    const element: ShallowRef<HTMLElement | null> = shallowRef(null);
    const Part = defineComponent(() => {
      const setElement = useKeepAliveElementRef(
        (value) => {
          element.value = value;
        },
        () => trigger.value,
      );
      const ref = (value: unknown) => setElement(value as HTMLElement | null);
      return () =>
        isSpan.value ? (
          <span key="span" data-testid="part" ref={ref} />
        ) : (
          <div key="div" data-testid="part" ref={ref} />
        );
    });
    const Branch = defineComponent({ setup: () => () => (hasPart.value ? <Part /> : null) });
    const Other = defineComponent({ setup: () => () => <span /> });
    const TriggerAndPart = defineComponent({
      setup: () => () => (
        <div>
          <button ref={trigger}>trigger</button>
          <KeepAlive>{visible.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
        </div>
      ),
    });
    return { TriggerAndPart, isSpan, hasPart, visible, element };
  }

  it('gives null while KeepAlive holds the part, and the element again at the activation', async () => {
    const { TriggerAndPart, visible, element } = createTriggerAndPart();
    await render(<TriggerAndPart />);
    const part = screen.getByTestId('part');
    expect(element.value).toBe(part);

    visible.value = false;
    await flushMicrotasks();

    expect(part.isConnected).toBe(false);
    expect(element.value).toBe(null);

    visible.value = true;
    await flushMicrotasks();

    expect(part.isConnected).toBe(true);
    expect(element.value).toBe(part);
  });

  it('gives a new element that a render makes while KeepAlive holds the part only at the activation', async () => {
    const { TriggerAndPart, isSpan, visible, element } = createTriggerAndPart();
    await render(<TriggerAndPart />);

    visible.value = false;
    await flushMicrotasks();
    isSpan.value = true;
    await flushMicrotasks();

    expect(element.value).toBe(null);

    visible.value = true;
    await flushMicrotasks();

    const part = screen.getByTestId('part');
    expect(part.tagName).toBe('SPAN');
    expect(element.value).toBe(part);
  });

  it('gives no element of a part that mounts while KeepAlive holds its branch until the activation', async () => {
    const { TriggerAndPart, hasPart, visible, element } = createTriggerAndPart();
    hasPart.value = false;
    await render(<TriggerAndPart />);

    visible.value = false;
    await flushMicrotasks();
    hasPart.value = true;
    await flushMicrotasks();

    expect(screen.queryByTestId('part')).toBe(null);
    expect(element.value).toBe(null);

    visible.value = true;
    await flushMicrotasks();

    expect(element.value).toBe(screen.getByTestId('part'));
  });

  it('gives the element of a part of an app that mounts in a detached element', async () => {
    const { TriggerAndPart, element } = createTriggerAndPart();
    const container = document.createElement('div');
    const app = createApp({ render: () => <TriggerAndPart /> });
    recordVueWarnings(app);
    app.mount(container);
    onTestFinished(() => app.unmount());
    await flushMicrotasks();

    expect(element.value).toBe(container.querySelector('[data-testid="part"]'));
    expect(element.value).not.toBe(null);
  });
});
