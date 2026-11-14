import { describe, expect, it } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { useKeepAliveElementRef } from './useKeepAliveElementRef';

describe('useKeepAliveElementRef', () => {
  const { render } = createRenderer();

  // A part in a `KeepAlive`. It renders a `div` or a `span`, and gives its element to `element`.
  async function renderPart() {
    const isSpan = shallowRef(false);
    const visible = shallowRef(true);
    const element: ShallowRef<HTMLElement | null> = shallowRef(null);
    const Part = defineComponent({
      setup() {
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
      },
    });
    const Other = defineComponent({ setup: () => () => <span /> });
    await render(() => (
      <KeepAlive>{visible.value ? <Part key="part" /> : <Other key="other" />}</KeepAlive>
    ));
    return { isSpan, visible, element };
  }

  it('gives null while KeepAlive holds the part, and the element again at the activation', async () => {
    const { visible, element } = await renderPart();
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
    const { isSpan, visible, element } = await renderPart();

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
});
