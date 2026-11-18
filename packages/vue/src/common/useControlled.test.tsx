import { expect, describe, it, vi } from 'vitest';
import { defineComponent, shallowRef, watch } from 'vue';
import type { WritableComputedRef } from 'vue';
import { createRenderer, flushMicrotasks, takeReportedMessages } from '#test-utils';
import { useControlled } from './useControlled';

interface TestComponentChildrenArgument {
  value: number | string | object | null | undefined;
  setValue: (newValue: number | string) => void;
}

interface TestComponentProps {
  value?: number | string;
  defaultValue?: number | string | object | null;
}

const TestComponent = defineComponent(
  (props: TestComponentProps, { slots }) => {
    const value = useControlled({
      controlled: () => props.value,
      default: () => props.defaultValue,
      name: 'TestComponent',
    });
    function setValue(next: number | string) {
      value.value = next;
    }
    return () => slots.default?.({ value: value.value, setValue });
  },
  { props: ['value', 'defaultValue'] },
);

const renderNothing = { default: () => null };

describe('useControlled', () => {
  const { render } = createRenderer();

  it('works correctly when is not controlled', async () => {
    let valueState;
    let setValueState: TestComponentChildrenArgument['setValue'];
    await render(
      <TestComponent
        defaultValue={1}
        v-slots={{
          default: ({ value, setValue }: TestComponentChildrenArgument) => {
            valueState = value;
            setValueState = setValue;
            return null;
          },
        }}
      />,
    );
    expect(valueState).toBe(1);

    setValueState!(2);
    await flushMicrotasks();

    expect(valueState).toBe(2);
  });

  it('works correctly when is controlled', async () => {
    let valueState;
    await render(
      <TestComponent
        value={1}
        v-slots={{
          default: ({ value }: TestComponentChildrenArgument) => {
            valueState = value;
            return null;
          },
        }}
      />,
    );
    expect(valueState).toBe(1);
  });

  it('VUE-141: keeps the last parent value and accepts a local write in the same task', async () => {
    const prop = shallowRef<string | null>();
    let model!: WritableComputedRef<string | null>;
    const Part = defineComponent(() => {
      model = useControlled<string | null>({
        controlled: () => prop.value,
        default: () => 'initial',
        name: 'Part',
      });
      return () => null;
    });
    await render(<Part />);

    model.value = 'local';
    expect(model.value).toBe('local');
    prop.value = 'parent';
    model.value = 'refused';
    expect(model.value).toBe('parent');

    prop.value = null;
    model.value = 'refused';
    expect(model.value).toBeNull();
    prop.value = 'last';
    prop.value = undefined;
    expect(model.value).toBe('last');
    model.value = 'next';
    expect(model.value).toBe('next');
    await flushMicrotasks();
    expect(model.value).toBe('next');
    expect(takeReportedMessages()).toEqual([]);
  });

  it('VUE-141: lets a synchronous release listener read the last value and write the next one', async () => {
    const prop = shallowRef<string | undefined>('first');
    let model!: WritableComputedRef<string>;
    let valueOnRelease: string | undefined;
    const Part = defineComponent(() => {
      watch(
        prop,
        (value) => {
          if (value === undefined) {
            valueOnRelease = model.value;
            model.value = 'local';
          }
        },
        { flush: 'sync' },
      );
      model = useControlled({
        controlled: () => prop.value,
        default: () => 'initial',
        name: 'Part',
      });
      return () => null;
    });
    await render(<Part />);

    prop.value = 'last';
    prop.value = undefined;
    expect(valueOnRelease).toBe('last');
    expect(model.value).toBe('local');
  });

  it('keeps the same array when a parent releases a derived selection', async () => {
    const selection = shallowRef<string[] | undefined>(['red']);
    let model!: WritableComputedRef<string[]>;
    const Part = defineComponent(() => {
      model = useControlled({
        controlled: () => selection.value?.slice(),
        default: () => [] as string[],
        name: 'Part',
      });
      return () => null;
    });
    await render(<Part />);
    const last = model.value;
    selection.value = undefined;
    expect(model.value).toBe(last);
  });

  it('VUE-141: keeps a ref default intact when the parent releases a ref value', async () => {
    const initial = shallowRef('initial');
    const last = shallowRef('last');
    const prop = shallowRef<typeof initial>();
    let model!: WritableComputedRef<typeof initial>;
    const Part = defineComponent(() => {
      model = useControlled({
        controlled: () => prop.value,
        default: () => initial,
        name: 'Part',
      });
      return () => null;
    });
    await render(<Part />);

    expect(model.value).toBe(initial);
    prop.value = last;
    prop.value = undefined;
    expect(model.value).toBe(last);
    model.value = shallowRef('local');
    expect(initial.value).toBe('initial');
    expect(last.value).toBe('last');
  });

  describe('prop: defaultValue', () => {
    it('stores a function default value instead of calling it', async () => {
      const defaultValue = () => 'called';
      let result: WritableComputedRef<() => string> | undefined;

      const TestHook = defineComponent(() => {
        result = useControlled({
          controlled: () => undefined,
          default: () => defaultValue,
          name: 'TestComponent',
        });
        return () => null;
      });

      await render(<TestHook />);

      expect(result!.value).toBe(defaultValue);
    });

    it('warns when changed after initial rendering', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { setProps } = await render(<TestComponent v-slots={renderNothing} />);

      expect(errorSpy).not.toHaveBeenCalled();

      await setProps({ defaultValue: 1 });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain(
        'Vase UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );
    });

    it('does not warn when controlled', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { setProps } = await render(
        <TestComponent value={1} defaultValue={0} v-slots={renderNothing} />,
      );

      expect(errorSpy).not.toHaveBeenCalled();

      await setProps({ defaultValue: 1 });

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('warns about a new default only while the part owns the value', async () => {
      const { setProps } = await render(<TestComponent defaultValue={0} v-slots={renderNothing} />);
      await setProps({ value: 2, defaultValue: 1 });
      expect(takeReportedMessages()).toEqual([]);

      await setProps({ value: undefined, defaultValue: 3 });
      expect(takeReportedMessages()).toEqual([
        expect.stringContaining(
          'changing the default value state of an uncontrolled TestComponent',
        ),
      ]);
    });

    it('does not warn when NaN', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await render(<TestComponent defaultValue={NaN} v-slots={renderNothing} />);

      expect(errorSpy).not.toHaveBeenCalled();
    });

    // Vue runs the comparison only when the default is a new value. A parent that makes the value
    // in its render function gives a new value on each render. These cases do the same.
    it('does not warn when an array', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { setProps } = await render(
        <TestComponent defaultValue={[]} v-slots={renderNothing} />,
      );

      expect(errorSpy).not.toHaveBeenCalled();

      await setProps({ defaultValue: [] });

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('does not throw when defaultValue has React elements', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // The render function makes the vnode, so the vnode holds the parent in `ctx`.
      const Parent = defineComponent(
        () => () => <TestComponent defaultValue={{ value: <span /> }} v-slots={renderNothing} />,
        { props: ['renders'] },
      );

      const { setProps } = await render(<Parent />);

      expect(errorSpy).not.toHaveBeenCalled();

      await setProps({ renders: 1 });

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('does not throw when defaultValue has function', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fn = () => 100;

      const { setProps } = await render(
        <TestComponent defaultValue={{ value: fn }} v-slots={renderNothing} />,
      );

      expect(errorSpy).not.toHaveBeenCalled();

      await setProps({ defaultValue: { value: fn } });

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('does not throw when defaultValue has bigint', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const TestComponentBigInt = defineComponent(() => {
        useControlled({
          controlled: () => undefined,
          default: () => 1n,
          name: 'TestComponent',
        });
        return () => null;
      });

      await render(<TestComponentBigInt />);

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should warn only when defaultValue changes', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { setProps } = await render(<TestComponent defaultValue={0} v-slots={renderNothing} />);

      expect(errorSpy).not.toHaveBeenCalled();

      await setProps({ defaultValue: 1 });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain(
        'Vase UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );
      errorSpy.mockClear();

      await setProps({ defaultValue: 2 });

      expect(errorSpy).not.toHaveBeenCalled();

      await setProps({ defaultValue: 0 });

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should warn only when defaultValue has functions/components and changes', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const items = [
        {
          item: <span />,
        },
        {
          item: () => 100,
        },
        {
          item: <div />,
        },
      ];

      const { setProps } = await render(
        <TestComponent defaultValue={items[0]} v-slots={renderNothing} />,
      );

      expect(errorSpy).not.toHaveBeenCalled();

      await setProps({ defaultValue: items[1] });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain(
        'Vase UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );
      errorSpy.mockClear();

      await setProps({ defaultValue: items[2] });

      expect(errorSpy).not.toHaveBeenCalled();

      await setProps({ defaultValue: items[0] });

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should not fail on null values', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const s1 = null;
      const s2 = undefined;

      const { setProps } = await render(
        <TestComponent defaultValue={s1} v-slots={renderNothing} />,
      );

      expect(errorSpy).not.toHaveBeenCalled();

      await setProps({ defaultValue: s2 });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toContain(
        'Vase UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );
      errorSpy.mockClear();

      await setProps({ defaultValue: s1 });

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
