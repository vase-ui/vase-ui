import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, h, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { NumberField } from '@vase-ui/vue/number-field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hiddenInputSizeTests,
  hydrate,
  mockRuntimeLocale,
  renderOnServer,
  screen,
} from '#test-utils';
import { defineNumberFieldContextProbe } from '../../../test/fixtures/numberFieldContextProbe';
import NumberFieldRootHydration from './NumberFieldRootHydration.test.vue';

type FieldRootInstance = InstanceType<typeof Field.Root>;

function getHiddenInput() {
  const hiddenInput = document.querySelector<HTMLInputElement>('input[aria-hidden][type=number]');
  if (!hiddenInput) {
    throw new Error('Expected a hidden number input.');
  }
  return hiddenInput;
}

function getText() {
  return screen.getByTestId<HTMLInputElement>('text');
}

// The way a browser fills a field: it sets the value, and then it sends `input` and `change`.
async function autofill(value: string) {
  const input = getHiddenInput();
  await fireEvent.input(input, { target: { value } });
  await fireEvent.change(input);
}

// The part follows a reset in a timeout of 0 ms, after the listeners of the event.
// The case that calls this function uses fake timers.
async function settleReset() {
  vi.advanceTimersByTime(0);
  await flushMicrotasks();
}

describe('<NumberField />', () => {
  const { render } = createRenderer();

  describeConformance(<NumberField.Root />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  hiddenInputSizeTests({
    render,
    // Base UI also renders `NumberField.Input` here. The suite reads only the hidden input.
    createComponent: (props) => <NumberField.Root {...props} />,
  });

  describe('hidden input size', () => {
    it('keeps the 1px size in the next render of the root', async () => {
      const { container } = await render(<NumberField.Root required />);
      const input = container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
      input.reportValidity();

      await autofill('5');

      expect(input.value).toBe('5');
      const { width, height } = input.getBoundingClientRect();
      expect({ width, height }).toEqual({ width: 1, height: 1 });
    });
  });

  describe('the hidden input', () => {
    it('is a number input that no assistive technology and no tab key reaches', async () => {
      await render(<NumberField.Root />);
      const input = getHiddenInput();

      expect(input).toHaveAttribute('aria-hidden', 'true');
      expect(input).toHaveAttribute('tabindex', '-1');
      expect(input).toHaveAttribute('step', '1');
      for (const attribute of ['min', 'max', 'name', 'form', 'required', 'readonly', 'disabled']) {
        expect(input).not.toHaveAttribute(attribute);
      }
    });

    it.each([
      {
        name: '`min`, `max` and `step`',
        props: { min: 2, max: 20, step: 2 },
        attributes: { min: '2', max: '20', step: '2' },
      },
      { name: '`step="any"`', props: { step: 'any' as const }, attributes: { step: 'any' } },
      {
        name: '`name` and `form`',
        props: { name: 'quantity', form: 'order' },
        attributes: { name: 'quantity', form: 'order' },
      },
      { name: '`required`', props: { required: true }, attributes: { required: '' } },
      { name: '`readOnly`', props: { readOnly: true }, attributes: { readonly: '' } },
      { name: '`disabled`', props: { disabled: true }, attributes: { disabled: '' } },
    ])('has the attributes of $name', async ({ props, attributes }) => {
      await render(<NumberField.Root {...props} />);

      for (const [name, value] of Object.entries(attributes)) {
        expect(getHiddenInput()).toHaveAttribute(name, value);
      }
    });

    it.each([
      { name: 'no value', props: {}, text: '' },
      { name: '`defaultValue`', props: { defaultValue: 1234.5 }, text: '1234.5' },
      { name: 'a `defaultValue` of zero', props: { defaultValue: 0 }, text: '0' },
      { name: '`value`', props: { value: 7 }, text: '7' },
      { name: 'a `value` of `null`', props: { value: null }, text: '' },
    ])('has the number of $name', async ({ props, text }) => {
      await render(<NumberField.Root {...props} />);

      expect(getHiddenInput().value).toBe(text);
      expect(getHiddenInput().getAttribute('value')).toBe(text);
    });

    it('follows a controlled value', async () => {
      const { setProps } = await render(<NumberField.Root value={1} />);

      await setProps({ value: 2.5 });
      expect(getHiddenInput().value).toBe('2.5');

      await setProps({ value: null });
      expect(getHiddenInput().value).toBe('');
    });
  });

  describe('v-model:value', () => {
    it('emits `valueChange` and then `update:value`, before the listener of the event returns', async () => {
      const order: string[] = [];
      await render(
        <NumberField.Root
          onValueChange={(value: number | null) => order.push(`valueChange ${value}`)}
          {...{ 'onUpdate:value': (value: number | null) => order.push(`update:value ${value}`) }}
        />,
      );
      const input = getHiddenInput();
      input.value = '7';

      input.dispatchEvent(new Event('input', { bubbles: true }));
      order.push('end of the event');

      expect(order).toEqual(['valueChange 7', 'update:value 7', 'end of the event']);
    });

    it('gives `valueChange` the reason `none` and the event of the hidden input', async () => {
      const handleChange = vi.fn();
      await render(<NumberField.Root onValueChange={handleChange} />);

      await autofill('7');

      const [value, details] = handleChange.mock.calls[0];
      expect(value).toBe(7);
      expect(details.reason).toBe('none');
      expect(details.event.type).toBe('input');
      expect(details.event.target).toBe(getHiddenInput());
    });

    it('does not emit `update:value`, and keeps the value, for a change that a listener cancels', async () => {
      const handleUpdate = vi.fn();
      await render(
        <NumberField.Root
          defaultValue={5}
          onValueChange={(_value: number | null, details: NumberField.Root.ChangeEventDetails) =>
            details.cancel()
          }
          {...{ 'onUpdate:value': handleUpdate }}
        />,
      );

      await autofill('7');

      expect(handleUpdate).not.toHaveBeenCalled();
      expect(getHiddenInput().value).toBe('5');
    });
  });

  describe('autofill', () => {
    it('changes the value one time for `input` and `change`', async () => {
      const handleChange = vi.fn();
      await render(<NumberField.Root onValueChange={handleChange} />);

      await autofill('42');

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.calls[0][0]).toBe(42);
    });

    it('changes the value for a `change` event that has no `input` event', async () => {
      const handleChange = vi.fn();
      await render(<NumberField.Root onValueChange={handleChange} />);

      await fireEvent.change(getHiddenInput(), { target: { value: '42' } });

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.calls[0][0]).toBe(42);
      expect(handleChange.mock.calls[0][1].event.type).toBe('change');
    });

    it('empties the value when the hidden input gets no value', async () => {
      const handleChange = vi.fn();
      await render(<NumberField.Root defaultValue={5} onValueChange={handleChange} />);

      await fireEvent.change(getHiddenInput(), { target: { value: '' } });

      expect(handleChange.mock.lastCall?.[0]).toBe(null);
      expect(getHiddenInput().value).toBe('');
    });

    it('ignores an autofill that a listener prevented', async () => {
      const handleChange = vi.fn();
      const { container } = await render(
        <NumberField.Root defaultValue={1} onValueChange={handleChange} />,
      );
      container.addEventListener('input', (event) => event.preventDefault(), { capture: true });
      const input = getHiddenInput();
      input.value = '42';

      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      await flushMicrotasks();

      expect(handleChange).not.toHaveBeenCalled();
      expect(input.value).toBe('1');
    });

    it.each([
      { name: 'a read-only field', props: { readOnly: true } },
      { name: 'a disabled field', props: { disabled: true } },
    ])('ignores the autofill of $name', async ({ props }) => {
      const handleChange = vi.fn();
      await render(<NumberField.Root defaultValue={1} onValueChange={handleChange} {...props} />);

      await autofill('42');

      expect(handleChange).not.toHaveBeenCalled();
      expect(getHiddenInput().value).toBe('1');
    });

    it.each([
      { name: 'above `max`', props: { max: 10 }, filled: '70', value: 10, invalid: null },
      {
        name: 'above `max` with `allowOutOfRange`',
        props: { max: 10, allowOutOfRange: true },
        filled: '70',
        value: 70,
        invalid: 'rangeOverflow',
      },
      {
        name: 'off the `step`',
        props: { min: 0, step: 2 },
        filled: '3',
        value: 3,
        invalid: 'stepMismatch',
      },
    ])('gives the field the value for a fill $name', async ({ props, filled, value, invalid }) => {
      const handleChange = vi.fn();
      await render(<NumberField.Root onValueChange={handleChange} {...props} />);

      await autofill(filled);

      expect(handleChange.mock.lastCall?.[0]).toBe(value);
      expect(getHiddenInput().value).toBe(String(value));
      for (const key of ['rangeOverflow', 'rangeUnderflow', 'stepMismatch'] as const) {
        expect(getHiddenInput().validity[key]).toBe(key === invalid);
      }
    });

    it('validates the number that the autofill gives', async () => {
      const validate = vi.fn((_value: unknown) => null);
      await render(
        <Field.Root name="quantity" validationMode="onChange" validate={validate}>
          <NumberField.Root />
        </Field.Root>,
      );

      await autofill('42');

      expect(validate.mock.calls.map(([value]) => value)).toEqual([42]);
    });

    it('validates the number that the field stores, not the number that the autofill gives', async () => {
      const validate = vi.fn((_value: unknown) => null);
      await render(
        <Field.Root name="quantity" validationMode="onChange" validate={validate}>
          <NumberField.Root max={10} />
        </Field.Root>,
      );

      await autofill('70');

      expect(validate.mock.calls.map(([value]) => value)).toEqual([10]);
    });

    it('validates the number of an autofill that a listener cancels', async () => {
      const validate = vi.fn((_value: unknown) => null);
      await render(
        <Field.Root name="quantity" validationMode="onChange" validate={validate}>
          <NumberField.Root
            onValueChange={(_value: number | null, details: NumberField.Root.ChangeEventDetails) =>
              details.cancel()
            }
          />
        </Field.Root>,
      );

      await autofill('7');

      expect(validate.mock.lastCall?.[0]).toBe(7);
      expect(getHiddenInput().value).toBe('');
    });

    it('clears the error that the form has for the name of the field', async () => {
      await render(
        <Form errors={{ quantity: 'Server error' }}>
          <Field.Root name="quantity" data-testid="field">
            <NumberField.Root />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );
      expect(screen.getByTestId('error')).toHaveTextContent('Server error');

      await autofill('5');

      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-invalid');
    });
  });

  describe('the hidden input has the value of the field', () => {
    it('after an autofill that a listener cancels', async () => {
      await render(
        <NumberField.Root
          defaultValue={5}
          onValueChange={(_value: number | null, details: NumberField.Root.ChangeEventDetails) =>
            details.cancel()
          }
        />,
      );

      await autofill('7');

      expect(getHiddenInput().value).toBe('5');
    });

    it('after an autofill that the parent of a controlled field does not accept', async () => {
      const handleUpdate = vi.fn();
      await render(<NumberField.Root value={5} {...{ 'onUpdate:value': handleUpdate }} />);

      await autofill('7');

      expect(handleUpdate.mock.calls).toEqual([[7]]);
      expect(getHiddenInput().value).toBe('5');
    });

    it('after a `pageshow` event, because a browser can restore the form state after the mount', async () => {
      const handleChange = vi.fn();
      await render(<NumberField.Root defaultValue={5} onValueChange={handleChange} />);
      getHiddenInput().value = '9';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));

      expect(getHiddenInput().value).toBe('5');
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('in a native form', () => {
    function getFormData(name = 'quantity') {
      return new FormData(screen.getByTestId<HTMLFormElement>('form')).getAll(name);
    }

    it.each([
      { name: 'no number', props: {}, data: [''] },
      { name: 'a number', props: { defaultValue: 1234.5 }, data: ['1234.5'] },
      {
        name: 'a number that the text formats',
        props: {
          defaultValue: 54.5,
          locale: 'de-DE',
          format: { style: 'currency' as const, currency: 'EUR' },
        },
        data: ['54.5'],
      },
    ])('submits the value of $name', async ({ props, data }) => {
      await render(
        <form data-testid="form">
          <NumberField.Root name="quantity" {...props} />
        </form>,
      );

      expect(getFormData()).toEqual(data);
    });

    it.each([
      { name: 'a field with no name', props: { name: undefined } },
      { name: 'a disabled field', props: { disabled: true } },
    ])('submits nothing for $name', async ({ props }) => {
      await render(
        <form data-testid="form">
          <NumberField.Root name="quantity" defaultValue={3} {...props} />
        </form>,
      );

      expect(Array.from(new FormData(screen.getByTestId<HTMLFormElement>('form')))).toEqual([]);
    });

    it('submits to the form that the `form` prop names', async () => {
      await render(
        <div>
          <form data-testid="form" id="external" />
          <form data-testid="parent">
            <NumberField.Root name="quantity" form="external" defaultValue={54.5} />
          </form>
        </div>,
      );

      expect(getFormData()).toEqual(['54.5']);
      expect(
        new FormData(screen.getByTestId<HTMLFormElement>('parent')).getAll('quantity'),
      ).toEqual([]);
    });

    it('does not submit a required field with no value, and focuses the text input', async () => {
      const { Probe } = defineNumberFieldContextProbe();
      const handleSubmit = vi.fn((event: Event) => event.preventDefault());
      const { user } = await render(
        <form data-testid="form" onSubmit={handleSubmit}>
          <NumberField.Root name="quantity" required>
            <Probe />
          </NumberField.Root>
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(getHiddenInput().validity.valueMissing).toBe(true);
      expect(getText()).toHaveFocus();

      await autofill('4');
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(getFormData()).toEqual(['4']);
    });

    it('does not validate a read-only field', async () => {
      const handleSubmit = vi.fn((event: Event) => event.preventDefault());
      const { user } = await render(
        <form data-testid="form" onSubmit={handleSubmit}>
          <NumberField.Root name="quantity" required readOnly />
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(getHiddenInput().willValidate).toBe(false);
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    describe('BUG-6206: a native reset', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it.each([
        { name: 'a number', defaultValue: 5, data: ['5'], value: 5 },
        { name: 'no number', defaultValue: undefined, data: [''], value: null },
      ])(
        'puts an uncontrolled field back to its default, $name',
        async ({ defaultValue, data, value }) => {
          const handleChange = vi.fn();
          await render(
            <form data-testid="form">
              <NumberField.Root
                name="quantity"
                defaultValue={defaultValue}
                onValueChange={handleChange}
              />
              <button type="reset">Reset</button>
            </form>,
          );
          await autofill('9');
          expect(getFormData()).toEqual(['9']);

          await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
          await settleReset();

          expect(getFormData()).toEqual(data);
          expect(handleChange).toHaveBeenCalledTimes(2);
          expect(handleChange.mock.lastCall?.[0]).toBe(value);
          expect(handleChange.mock.lastCall?.[1].event.type).toBe('reset');

          // A reset with nothing to change.
          await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
          await settleReset();

          expect(handleChange).toHaveBeenCalledTimes(2);
        },
      );

      it.each([
        {
          name: 'a controlled field',
          renderForm: () => {
            const value = shallowRef<number | null>(1);
            return () => (
              <form data-testid="form">
                <NumberField.Root
                  name="quantity"
                  value={value.value}
                  {...{ 'onUpdate:value': (next: number | null) => (value.value = next) }}
                />
              </form>
            );
          },
        },
        {
          name: 'a field whose listener cancels',
          renderForm: () => () => (
            <form data-testid="form">
              <NumberField.Root
                name="quantity"
                defaultValue={1}
                onValueChange={(
                  _value: number | null,
                  details: NumberField.Root.ChangeEventDetails,
                ) => {
                  if (details.event.type === 'reset') {
                    details.cancel();
                  }
                }}
              />
            </form>
          ),
        },
        {
          name: 'a field whose form cancels the reset',
          renderForm: () => () => (
            <form data-testid="form" onReset={(event: Event) => event.preventDefault()}>
              <NumberField.Root name="quantity" defaultValue={1} />
            </form>
          ),
        },
        {
          name: 'a field whose window cancels the reset',
          renderForm: () => {
            // The window gets the event after the root node of the field.
            const cancelReset = (event: Event) => event.preventDefault();
            window.addEventListener('reset', cancelReset);
            onTestFinished(() => window.removeEventListener('reset', cancelReset));
            return () => (
              <form data-testid="form">
                <NumberField.Root name="quantity" defaultValue={1} />
              </form>
            );
          },
        },
        {
          name: 'a field of another form',
          renderForm: () => () => (
            <div>
              <form data-testid="form" />
              <form id="other" />
              <NumberField.Root name="quantity" form="other" defaultValue={1} />
            </div>
          ),
        },
      ])('does not change $name', async ({ renderForm }) => {
        await render(h(defineComponent(renderForm)));
        await autofill('9');
        expect(getHiddenInput().value).toBe('9');

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(getHiddenInput().value).toBe('9');
      });

      it('resets a field outside the form that its `form` prop names', async () => {
        await render(
          <div>
            <form data-testid="form" id="external" />
            <NumberField.Root name="quantity" form="external" defaultValue={2} />
          </div>,
        );
        await autofill('9');
        expect(getFormData()).toEqual(['9']);

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(getFormData()).toEqual(['2']);
      });

      it('puts the text of the input back to the formatted default', async () => {
        const { Probe, getContext } = defineNumberFieldContextProbe();
        await render(
          <form data-testid="form">
            <NumberField.Root name="quantity" defaultValue={1234.5}>
              <Probe />
            </NumberField.Root>
          </form>,
        );
        expect(getText().value).toBe('1,234.5');
        // The user types text that is not a number.
        getContext().allowInputSyncRef.value = false;
        getContext().setInputValue('12x');
        await flushMicrotasks();
        expect(getText().value).toBe('12x');

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(getText().value).toBe('1,234.5');
      });

      it('leaves no commit pending for the change of a reset', async () => {
        const { Probe, getContext } = defineNumberFieldContextProbe();
        await render(
          <form data-testid="form">
            <NumberField.Root defaultValue={5}>
              <Probe />
            </NumberField.Root>
          </form>,
        );
        await autofill('9');
        expect(getContext().hasPendingCommitRef.value).toBe(true);

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(getContext().hasPendingCommitRef.value).toBe(false);
      });

      it('tells the parts that a reset changes the value, until the render ends', async () => {
        const seen: boolean[] = [];
        const { Probe, getContext } = defineNumberFieldContextProbe((context) =>
          seen.push(context.isResetChangePending.value),
        );
        await render(
          <form data-testid="form">
            <NumberField.Root defaultValue={5}>
              <Probe />
            </NumberField.Root>
          </form>,
        );
        await autofill('9');
        expect(seen).toEqual([false]);

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(seen).toEqual([false, true]);
        expect(getContext().isResetChangePending.value).toBe(false);
      });
    });
  });

  describe('in a field', () => {
    it('takes `name` and `disabled` from the field', async () => {
      await render(
        <Field.Root name="field" disabled>
          <NumberField.Root name="own" data-testid="root" />
        </Field.Root>,
      );

      expect(getHiddenInput().name).toBe('field');
      expect(getHiddenInput().disabled).toBe(true);
      expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');
    });

    it('gives `filled` and `dirty` to the field, and takes them back', async () => {
      await render(
        <Field.Root data-testid="field">
          <NumberField.Root data-testid="root" />
        </Field.Root>,
      );
      for (const testId of ['root', 'field']) {
        expect(screen.getByTestId(testId)).not.toHaveAttribute('data-filled');
        expect(screen.getByTestId(testId)).not.toHaveAttribute('data-dirty');
      }

      await autofill('3');

      for (const testId of ['root', 'field']) {
        expect(screen.getByTestId(testId)).toHaveAttribute('data-filled');
        expect(screen.getByTestId(testId)).toHaveAttribute('data-dirty');
      }

      await autofill('');

      for (const testId of ['root', 'field']) {
        expect(screen.getByTestId(testId)).not.toHaveAttribute('data-filled');
        expect(screen.getByTestId(testId)).not.toHaveAttribute('data-dirty');
      }
    });

    it('gives the native constraints of the hidden input to the validation of the field', async () => {
      let field = null as FieldRootInstance | null;
      await render(() => (
        <Field.Root
          ref={(instance) => {
            field = instance as FieldRootInstance | null;
          }}
          name="quantity"
        >
          <NumberField.Root required />
          <Field.Error match="valueMissing" data-testid="error">
            Enter a number
          </Field.Error>
        </Field.Root>
      ));
      expect(screen.queryByTestId('error')).toBe(null);

      field!.validate();
      await flushMicrotasks();

      expect(screen.getByTestId('error')).toHaveTextContent('Enter a number');
    });

    describe('VUE-21: a native reset clears the error of the field', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      async function resetForm() {
        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();
      }

      // The field is neutral, as after a reset of `Field.Control`.
      function expectNeutralField() {
        expect(screen.queryByTestId('error')).toBe(null);
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-valid');
      }

      const errors = { quantity: 'Server error' };
      const validate = vi.fn((value: unknown) =>
        typeof value === 'number' && value > 5 ? 'Too big' : null,
      );

      beforeEach(() => {
        validate.mockClear();
      });

      it.each([
        {
          name: 'the form for a field at its default',
          renderForm: () => () => (
            <Form data-testid="form" errors={errors}>
              <Field.Root data-testid="root" name="quantity">
                <NumberField.Root />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          ),
        },
        {
          name: 'the form for a controlled field',
          renderForm: () => {
            const value = shallowRef<number | null>(1);
            return () => (
              <Form data-testid="form" errors={errors}>
                <Field.Root data-testid="root" name="quantity">
                  <NumberField.Root
                    value={value.value}
                    {...{ 'onUpdate:value': (next: number | null) => (value.value = next) }}
                  />
                  <Field.Error data-testid="error" />
                </Field.Root>
              </Form>
            );
          },
        },
      ])('VUE-21: clears the error of $name', async ({ renderForm }) => {
        await render(h(defineComponent(renderForm)));
        expect(screen.getByTestId('error')).toHaveTextContent('Server error');

        await resetForm();

        expectNeutralField();
      });

      it('VUE-21: clears the error when the reset changes the value, does not validate it, and validates the next fill', async () => {
        await render(
          <Form data-testid="form">
            <Field.Root
              data-testid="root"
              name="quantity"
              validate={validate}
              validationMode="onChange"
            >
              <NumberField.Root defaultValue={1} />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        await autofill('9');
        expect(screen.getByTestId('error')).toHaveTextContent('Too big');
        expect(validate).toHaveBeenCalledTimes(1);

        await resetForm();

        expect(getHiddenInput().value).toBe('1');
        expect(validate).toHaveBeenCalledTimes(1);
        expectNeutralField();

        await autofill('8');

        expect(validate).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('error')).toHaveTextContent('Too big');
      });

      it('VUE-21: clears the error of a field whose listener cancels the reset, and validates the next fill', async () => {
        await render(
          <Form data-testid="form">
            <Field.Root
              data-testid="root"
              name="quantity"
              validate={validate}
              validationMode="onChange"
            >
              <NumberField.Root
                onValueChange={(
                  _value: number | null,
                  details: NumberField.Root.ChangeEventDetails,
                ) => {
                  if (details.event.type === 'reset') {
                    details.cancel();
                  }
                }}
              />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        await autofill('9');
        expect(screen.getByTestId('error')).toHaveTextContent('Too big');

        await resetForm();

        expect(getHiddenInput().value).toBe('9');
        expect(validate).toHaveBeenCalledTimes(1);
        expectNeutralField();

        await autofill('8');

        expect(validate).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('error')).toHaveTextContent('Too big');
      });

      it('VUE-21: clears the error of a controlled field that the reset does not change', async () => {
        const App = defineComponent(() => {
          const value = shallowRef<number | null>(1);
          return () => (
            <Form data-testid="form">
              <Field.Root
                data-testid="root"
                name="quantity"
                validate={validate}
                validationMode="onChange"
              >
                <NumberField.Root
                  value={value.value}
                  {...{ 'onUpdate:value': (next: number | null) => (value.value = next) }}
                />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          );
        });
        await render(<App />);
        await autofill('9');
        expect(screen.getByTestId('error')).toHaveTextContent('Too big');

        await resetForm();

        expect(getHiddenInput().value).toBe('9');
        expect(validate).toHaveBeenCalledTimes(1);
        expectNeutralField();
      });
    });
  });

  describe('server-side rendering', () => {
    const file = 'src/number-field/root/NumberFieldRootHydration.test.vue';

    it.each([
      { name: 'a field with no number', props: {} },
      { name: 'a field with a number', props: { defaultValue: 1234.5, name: 'quantity' } },
      { name: 'a controlled field', props: { value: 7 } },
      {
        name: 'a number with a format and a locale',
        props: {
          defaultValue: 54.5,
          locale: 'de-DE',
          format: { style: 'currency', currency: 'EUR' },
        },
      },
      { name: 'a field with `min`, `max` and `step`', props: { min: 1, max: 9, step: 2 } },
      {
        name: 'a disabled, read-only, required field',
        props: { disabled: true, readOnly: true, required: true },
      },
      {
        name: 'a field in a Field.Root',
        props: { inField: true, defaultValue: 2, name: 'quantity' },
      },
    ])('hydrates $name with no mismatch', async ({ props }) => {
      const serverHtml = await renderOnServer(file, props);

      await hydrate(NumberFieldRootHydration, { serverHtml, props });
    });

    it('formats the text in the locale of the runtime after the mount', async () => {
      // A formatter is cached by its locale and its options, so no earlier case formats with these.
      const props = { defaultValue: 1234.5, format: { minimumFractionDigits: 2 } };
      const serverHtml = await renderOnServer(file, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(template.content.querySelector('[data-testid="text"]')?.textContent).toBe('1,234.50');
      mockRuntimeLocale('de-DE');

      const { container } = await hydrate(NumberFieldRootHydration, { serverHtml, props });

      expect(container.querySelector('[data-testid="text"]')).toHaveTextContent('1.234,50');
    });
  });

  describe('KeepAlive', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps its state, and a reset of the form does not change a field that is not shown', async () => {
      const App = defineComponent({
        props: { shown: { type: Boolean, default: true } },
        setup(props) {
          return () => (
            <form data-testid="form">
              <KeepAlive>
                {props.shown ? (
                  <NumberField.Root key="field" name="quantity" defaultValue={1} />
                ) : null}
              </KeepAlive>
            </form>
          );
        },
      });
      const { setProps } = await render(<App />);
      const form = screen.getByTestId<HTMLFormElement>('form');
      await autofill('9');

      await setProps({ shown: false });

      expect(new FormData(form).getAll('quantity')).toEqual([]);

      form.reset();
      await settleReset();
      await setProps({ shown: true });

      expect(getHiddenInput().value).toBe('9');
      expect(new FormData(form).getAll('quantity')).toEqual(['9']);

      form.reset();
      await settleReset();

      expect(getHiddenInput().value).toBe('1');
    });
  });
});
