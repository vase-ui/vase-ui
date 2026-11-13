import { expect, describe, it, vi } from 'vitest';
import { defineComponent, KeepAlive, provide, shallowRef, toValue } from 'vue';
import { createRenderer, flushMicrotasks, screen, takeReportedMessages } from '#test-utils';
import {
  DEFAULT_FIELD_ROOT_CONTEXT,
  FieldRootContext,
} from '../field-root-context/FieldRootContext';
import { useRegisterFieldControl } from './useRegisterFieldControl';

interface ControlValues {
  id: string | undefined;
  name: string | undefined;
  value: unknown;
  enabled: boolean;
}

describe('useRegisterFieldControl', () => {
  const { render } = createRenderer();

  // The spy takes the place of the registry of a field.
  function setup(initial: Partial<ControlValues> = {}) {
    const values = shallowRef<ControlValues>({
      id: 'control',
      name: 'name',
      value: 'value',
      enabled: true,
      ...initial,
    });
    const registerFieldControl = vi.fn();
    const callsInSetup = { count: -1 };

    const Field = defineComponent((_props, { slots }) => {
      provide(FieldRootContext, {
        ...DEFAULT_FIELD_ROOT_CONTEXT,
        setValidityData: vi.fn(),
        registerFieldControl,
      });
      return () => slots.default?.();
    });

    const Control = defineComponent(() => {
      const element = shallowRef<HTMLElement | null>(null);
      useRegisterFieldControl(
        element,
        () => values.value.id,
        () => values.value.value,
        undefined,
        () => values.value.enabled,
        () => values.value.name,
      );
      callsInSetup.count = registerFieldControl.mock.calls.length;
      return () => <input ref={element} data-testid="control" />;
    });

    return { values, registerFieldControl, callsInSetup, Field, Control };
  }

  it('registers one getter after the mount, and the getter follows a change of `id`, `name` and `value` with no second call', async () => {
    const { values, registerFieldControl, callsInSetup, Field, Control } = setup();

    await render(
      <Field>
        <Control />
      </Field>,
    );

    expect(callsInSetup.count).toBe(0);
    expect(registerFieldControl).toHaveBeenCalledTimes(1);
    const [source, getRegistration] = registerFieldControl.mock.calls[0];
    expect(typeof source).toBe('symbol');
    const registration = getRegistration();
    expect(registration).toMatchObject({ id: 'control', name: 'name', value: 'value' });
    expect(toValue(registration.controlRef)).toBe(screen.getByTestId('control'));

    values.value = { ...values.value, id: 'other', name: 'other name', value: 'other value' };
    await flushMicrotasks();

    expect(getRegistration()).toMatchObject({
      id: 'other',
      name: 'other name',
      value: 'other value',
    });
    expect(registerFieldControl).toHaveBeenCalledTimes(1);
  });

  it('gives `undefined` while `enabled` is `false`, and the values again when it is `true`', async () => {
    const { values, registerFieldControl, Field, Control } = setup({ enabled: false });

    await render(
      <Field>
        <Control />
      </Field>,
    );
    const getRegistration = registerFieldControl.mock.calls[0][1];
    expect(getRegistration()).toBeUndefined();

    values.value = { ...values.value, enabled: true };
    expect(getRegistration()).toMatchObject({ id: 'control', value: 'value' });

    values.value = { ...values.value, enabled: false };
    await flushMicrotasks();

    expect(getRegistration()).toBeUndefined();
    expect(registerFieldControl).toHaveBeenCalledTimes(1);
  });

  it('removes the registration when the control goes away', async () => {
    const { registerFieldControl, Field, Control } = setup();
    const shown = shallowRef(true);
    const Test = defineComponent(() => () => <Field>{shown.value && <Control />}</Field>);
    await render(<Test />);
    const source = registerFieldControl.mock.calls[0][0];

    shown.value = false;
    await flushMicrotasks();

    expect(registerFieldControl).toHaveBeenCalledTimes(2);
    expect(registerFieldControl).toHaveBeenLastCalledWith(source, undefined);
  });

  it('does nothing and gives no warning when there is no field', async () => {
    const { Control } = setup();

    const { unmount } = await render(<Control />);

    expect(screen.getByTestId('control')).toBeInTheDocument();
    unmount();
    expect(takeReportedMessages()).toEqual([]);
  });

  describe('under `KeepAlive`', () => {
    it('gives `undefined` while the control is deactivated, and the values after the activation, with no new call', async () => {
      const { registerFieldControl, Field, Control } = setup();
      const shown = shallowRef(true);
      const Test = defineComponent(() => () => (
        <Field>
          <KeepAlive>{shown.value ? <Control /> : null}</KeepAlive>
        </Field>
      ));
      await render(<Test />);
      const getRegistration = registerFieldControl.mock.calls[0][1];
      expect(getRegistration()).toMatchObject({ id: 'control', value: 'value' });

      shown.value = false;
      await flushMicrotasks();

      expect(getRegistration()).toBeUndefined();

      shown.value = true;
      await flushMicrotasks();

      expect(getRegistration()).toMatchObject({ id: 'control', value: 'value' });
      expect(registerFieldControl).toHaveBeenCalledTimes(1);
    });

    it('removes the registration of a control that `KeepAlive` drops while the control is hidden', async () => {
      const { registerFieldControl, Field, Control } = setup();
      const key = shallowRef('first');
      // Each control has its own key, so `KeepAlive` keeps the control that the next control replaces.
      const Test = defineComponent(() => () => (
        <Field>
          <KeepAlive max={2}>
            <Control key={key.value} />
          </KeepAlive>
        </Field>
      ));
      await render(<Test />);
      const firstSource = registerFieldControl.mock.calls[0][0];

      key.value = 'second';
      await flushMicrotasks();
      key.value = 'third';
      await flushMicrotasks();

      // `KeepAlive` keeps two controls. It drops the oldest control, which is hidden.
      const removals = registerFieldControl.mock.calls.filter(
        ([, getRegistration]) => getRegistration === undefined,
      );
      expect(removals).toEqual([[firstSource, undefined]]);
    });
  });
});
