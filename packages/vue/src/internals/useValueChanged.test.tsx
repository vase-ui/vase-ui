import { expect, vi, describe, it } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks } from '#test-utils';
import { useValueChanged } from './useValueChanged';

describe('useValueChanged', () => {
  const { render } = createRenderer();

  // Vue compares the props of a vnode with `!==`, so a prop that changes from `0` to `-0` does not
  // reach the component. The value is a ref that the test writes.
  it('retains -0 as the previous value without treating it as a change from 0 (strict: %s)', async () => {
    const onChange = vi.fn();
    const value = shallowRef(0);
    const Test = defineComponent(() => {
      useValueChanged(value, onChange);
      return () => null;
    });
    await render(<Test />);

    value.value = -0;
    await flushMicrotasks();

    expect(onChange).not.toHaveBeenCalled();

    value.value = 1;
    await flushMicrotasks();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(Object.is(onChange.mock.calls[0][0], -0)).toBe(true);
  });

  it('calls the callback with the previous value after the DOM update of each change, and not at the mount', async () => {
    const checked = shallowRef(false);
    const calls: { previous: boolean; checkedInDom: boolean }[] = [];
    const Test = defineComponent(() => {
      const input = shallowRef<HTMLInputElement | null>(null);
      useValueChanged(checked, (previous) => {
        calls.push({ previous, checkedInDom: input.value?.checked ?? false });
      });
      return () => <input type="checkbox" checked={checked.value} ref={input} />;
    });
    await render(<Test />);
    expect(calls).toEqual([]);

    checked.value = true;
    await flushMicrotasks();
    checked.value = false;
    await flushMicrotasks();

    expect(calls).toEqual([
      { previous: false, checkedInDom: true },
      { previous: true, checkedInDom: false },
    ]);
  });

  describe('under `KeepAlive`', () => {
    it('waits for the activation, and gives the value from before the deactivation', async () => {
      const onChange = vi.fn();
      const value = shallowRef(1);
      const Child = defineComponent(() => {
        useValueChanged(value, onChange);
        return () => null;
      });
      const Test = defineComponent(
        (props: { shown: boolean }) => () => (
          <KeepAlive>{props.shown ? <Child /> : null}</KeepAlive>
        ),
        { props: ['shown'] },
      );
      const { rerender } = await render(<Test shown />);
      await rerender(<Test shown={false} />);

      value.value = 2;
      await flushMicrotasks();

      expect(onChange).not.toHaveBeenCalled();

      await rerender(<Test shown />);
      await flushMicrotasks();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(1);
    });
  });
});
