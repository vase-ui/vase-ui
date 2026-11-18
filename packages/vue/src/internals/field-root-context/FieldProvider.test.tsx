import { describe, expect, it } from 'vitest';
import {
  defineComponent,
  inject,
  KeepAlive,
  nextTick,
  onDeactivated,
  provide,
  shallowRef,
} from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Field } from '@vase-ui/vue/field';
import { Select } from '@vase-ui/vue/select';
import { createRenderer, screen, waitFor } from '#test-utils';
import { LabelableContext, useLabelableContext } from '../labelable-provider/LabelableContext';
import { NOOP } from '../noop';
import { FieldRootContext, useFieldRootContext } from './FieldRootContext';

describe('field providers', () => {
  const { render } = createRenderer();

  const Scope = defineComponent((_props, { slots }) => {
    provide(FieldRootContext, { ...useFieldRootContext(false), setValidityData: NOOP });
    provide(LabelableContext, { ...useLabelableContext(), registerControlId: NOOP });
    return () => slots.default?.();
  });

  const Input = defineComponent(() => {
    const field = inject(FieldRootContext, null);
    return () => <input data-field={field ? 'present' : 'absent'} />;
  });

  it('masks the field for a component rendered by the popup input', async () => {
    await render(
      <Field.Root>
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>Choose</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input as={Input} data-testid="search" />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>,
    );

    expect(await screen.findByTestId('search')).toHaveAttribute('data-field', 'absent');
  });

  it('masks the field for the time field of a date picker', async () => {
    await render(
      <Field.Root>
        <DatePicker.Root granularity="minute">
          <DatePicker.TimeField>
            <Input data-testid="time" />
          </DatePicker.TimeField>
        </DatePicker.Root>
      </Field.Root>,
    );

    expect(screen.getByTestId('time')).toHaveAttribute('data-field', 'absent');
  });

  it('releases focus before the parent deactivation hook', async () => {
    let focusedAtHold: boolean | undefined;
    const shown = shallowRef(true);
    const Branch = defineComponent(() => {
      const field = useFieldRootContext(false);
      onDeactivated(() => {
        focusedAtHold = field.state.value.focused;
      });
      return () => <Field.Control />;
    });
    await render(() => (
      <Field.Root data-testid="field">
        <KeepAlive>{shown.value ? <Branch /> : null}</KeepAlive>
      </Field.Root>
    ));

    const input = screen.getByRole('textbox');
    input.focus();
    await nextTick();
    expect(screen.getByTestId('field')).toHaveAttribute('data-focused');
    input.addEventListener('focusout', (event) => event.stopImmediatePropagation(), {
      capture: true,
      once: true,
    });
    shown.value = false;
    await nextTick();
    expect(focusedAtHold).toBe(false);
  });

  it('VUE-83: validates the visible input in the parent deactivation hook', async () => {
    const field = shallowRef<InstanceType<typeof Field.Root> | null>(null);
    const shown = shallowRef(true);
    const Branch = defineComponent(() => {
      onDeactivated(() => field.value?.validate());
      return () => <Field.Control defaultValue="cached" />;
    });
    await render(() => (
      <Field.Root ref={field} data-testid="field">
        <Field.Control required />
        <KeepAlive>{shown.value ? <Branch /> : null}</KeepAlive>
      </Field.Root>
    ));

    const root = screen.getByTestId('field');
    field.value!.validate();
    await nextTick();
    expect(root).toHaveAttribute('data-valid');

    shown.value = false;
    await nextTick();
    expect(root).toHaveAttribute('data-invalid');
  });

  it.each([
    { name: 'Select', root: () => <Select.Root /> },
    { name: 'Combobox', root: () => <Combobox.Root /> },
  ])('keeps the unnamed $name input eligible for validation', async ({ root }) => {
    const { container } = await render(() => (
      <Field.Root>
        <Scope>{root()}</Scope>
      </Field.Root>
    ));

    expect(container.querySelector('input')?.willValidate).toBe(true);
  });

  it('gives the field its input and follows its element id', async () => {
    let field: FieldRootContext;
    const ReadField = defineComponent(() => {
      field = useFieldRootContext();
      return () => <Field.Control />;
    });
    await render(
      <Field.Root>
        <Field.Label>Address</Field.Label>
        <Scope>
          <ReadField />
        </Scope>
      </Field.Root>,
    );

    const input = screen.getByRole('textbox');
    expect(field!.validation.inputRef.value).toBe(input);
    input.id = 'street-address';
    await waitFor(() =>
      expect(screen.getByText('Address')).toHaveAttribute('for', 'street-address'),
    );
    expect(input).toHaveAccessibleName('Address');
  });
});
