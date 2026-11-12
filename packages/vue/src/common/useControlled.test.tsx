import { expect, describe, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import type { ComputedRef } from 'vue';
import { createRenderer, flushMicrotasks } from '#test-utils';
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
    const [value, setValue] = useControlled({
      controlled: () => props.value,
      default: () => props.defaultValue,
      name: 'TestComponent',
    });
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

  it('warns when switching from uncontrolled to controlled', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { setProps } = await render(<TestComponent v-slots={renderNothing} />);

    expect(errorSpy).not.toHaveBeenCalled();

    await setProps({ value: 'foobar' });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain(
      'Vase UI: A component is changing the uncontrolled value state of TestComponent to be controlled.',
    );
  });

  it('warns and falls back to the default when switching from controlled to uncontrolled', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let result: [ComputedRef<string>, (newValue: string) => void] | undefined;

    const TestHook = defineComponent(
      (props: { controlled: string | undefined }) => {
        result = useControlled({
          controlled: () => props.controlled,
          default: () => 'default',
          name: 'TestHook',
        });
        return () => null;
      },
      { props: ['controlled'] },
    );

    const { setProps } = await render(<TestHook controlled="foobar" />);

    expect(errorSpy).not.toHaveBeenCalled();

    const [value, setValue] = result!;

    expect(value.value).toBe('foobar');

    await setProps({ controlled: undefined });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain(
      'Vase UI: A component is changing the controlled value state of TestHook to be uncontrolled.',
    );

    expect(value.value).toBe('default');

    setValue('next');
    await flushMicrotasks();

    expect(value.value).toBe('default');
  });

  describe('prop: defaultValue', () => {
    it('stores a function default value instead of calling it', async () => {
      const defaultValue = () => 'called';
      let result: [ComputedRef<() => string>, (newValue: () => string) => void] | undefined;

      const TestHook = defineComponent(() => {
        result = useControlled({
          controlled: () => undefined,
          default: () => defaultValue,
          name: 'TestComponent',
        });
        return () => null;
      });

      await render(<TestHook />);

      expect(result![0].value).toBe(defaultValue);
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

    it('does not warn when NaN', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await render(<TestComponent defaultValue={NaN} v-slots={renderNothing} />);

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('does not warn when an array', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const TestComponentArray = defineComponent(() => {
        useControlled({
          controlled: () => undefined,
          default: () => [],
          name: 'TestComponent',
        });
        return () => null;
      });

      await render(<TestComponentArray />);

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('does not throw when defaultValue has React elements', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const TestComponentArray = defineComponent(() => {
        useControlled({
          controlled: () => undefined,
          default: () => ({
            value: <span />,
          }),
          name: 'TestComponent',
        });
        return () => null;
      });

      await render(<TestComponentArray />);

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('does not throw when defaultValue has function', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fn = () => 100;

      const TestComponentArray = defineComponent(() => {
        useControlled({
          controlled: () => undefined,
          default: () => ({
            value: fn,
          }),
          name: 'TestComponent',
        });
        return () => null;
      });

      await render(<TestComponentArray />);

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
