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
  isJSDOM,
  mockRuntimeLocale,
  renderOnServer,
  screen,
} from '#test-utils';
import { defineNumberFieldContextProbe } from '../../../test/fixtures/numberFieldContextProbe';
import NumberFieldRootHydration from './NumberFieldRootHydration.test.vue';
import NumberFieldRootReplace from './NumberFieldRootReplace.test.vue';

type FieldRootInstance = InstanceType<typeof Field.Root>;
type NumberFieldRootInstance = InstanceType<typeof NumberField.Root>;

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

// The way a browser extension or a test tool fills a field: both events come in one task, with no
// microtask between them.
function fillInOneTask(value: string) {
  const input = getHiddenInput();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
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
    createComponent: (props) => (
      <NumberField.Root {...props}>
        <NumberField.Input />
      </NumberField.Root>
    ),
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

    it('is the `inputElement` that the root exposes', async () => {
      let root = null as NumberFieldRootInstance | null;
      await render(() => (
        <NumberField.Root
          ref={(instance) => {
            root = instance as NumberFieldRootInstance | null;
          }}
        />
      ));

      expect(root!.inputElement).toBe(getHiddenInput());
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

    it.each([
      {
        name: 'a controlled field',
        renderField: (handleChange: (value: number | null) => void) => {
          const value = shallowRef<number | null>(null);
          return () => (
            <NumberField.Root
              value={value.value}
              onValueChange={handleChange}
              {...{ 'onUpdate:value': (next: number | null) => (value.value = next) }}
            />
          );
        },
        filled: '42',
        changes: [42],
        text: '42',
      },
      {
        name: 'a fill above `max`',
        renderField: (handleChange: (value: number | null) => void) => () => (
          <NumberField.Root max={10} onValueChange={handleChange} />
        ),
        filled: '70',
        changes: [10],
        text: '10',
      },
      {
        name: 'a change that a listener cancels',
        renderField: (handleChange: (value: number | null) => void) => () => (
          <NumberField.Root
            onValueChange={(value: number | null, details: NumberField.Root.ChangeEventDetails) => {
              handleChange(value);
              details.cancel();
            }}
          />
        ),
        filled: '7',
        changes: [7],
        text: '',
      },
    ])(
      'emits one `valueChange` for `input` and `change` in one task: $name',
      async ({ renderField, filled, changes, text }) => {
        const handleChange = vi.fn();
        await render(h(defineComponent(() => renderField(handleChange))));

        fillInOneTask(filled);
        await flushMicrotasks();

        expect(handleChange.mock.calls.map(([value]) => value)).toEqual(changes);
        expect(getHiddenInput().value).toBe(text);
      },
    );

    it('handles a `change` event that has the value of the last handled event, after the parent cleared the value', async () => {
      const handleChange = vi.fn();
      const value = shallowRef<number | null>(null);
      await render(() => (
        <NumberField.Root
          value={value.value}
          onValueChange={handleChange}
          {...{ 'onUpdate:value': (next: number | null) => (value.value = next) }}
        />
      ));
      await autofill('42');
      value.value = null;
      await flushMicrotasks();
      expect(getHiddenInput().value).toBe('');

      await fireEvent.change(getHiddenInput(), { target: { value: '42' } });

      expect(handleChange.mock.calls.map(([next]) => next)).toEqual([42, 42]);
    });

    it('ignores a `change` event that has the value of the mount', async () => {
      const validate = vi.fn((_value: unknown) => null);
      await render(
        <Field.Root name="quantity" validationMode="onChange" validate={validate}>
          <NumberField.Root defaultValue={5} />
        </Field.Root>,
      );

      await fireEvent.change(getHiddenInput());

      expect(validate).not.toHaveBeenCalled();
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

      it('handles a `change` event that has the value that the reset replaced', async () => {
        const handleChange = vi.fn();
        await render(
          <form data-testid="form">
            <NumberField.Root defaultValue={5} onValueChange={handleChange} />
          </form>,
        );
        await autofill('9');
        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();
        expect(getHiddenInput().value).toBe('5');

        await fireEvent.change(getHiddenInput(), { target: { value: '9' } });

        expect(handleChange.mock.calls.map(([value]) => value)).toEqual([9, 5, 9]);
      });

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
        const formattedDefault = new Intl.NumberFormat().format(1234.5);
        const { Probe, getContext } = defineNumberFieldContextProbe();
        await render(
          <form data-testid="form">
            <NumberField.Root name="quantity" defaultValue={1234.5}>
              <Probe />
            </NumberField.Root>
          </form>,
        );
        expect(getText().value).toBe(formattedDefault);
        // The user types text that is not a number.
        getContext().allowInputSyncRef.value = false;
        getContext().setInputValue('12x');
        await flushMicrotasks();
        expect(getText().value).toBe('12x');

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(getText().value).toBe(formattedDefault);
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

    it('uses a root that mounts before the old root unmounts as the input of the field', async () => {
      const swapped = shallowRef(false);
      const fixture = shallowRef<{ validate: () => void } | null>(null);
      await render(() => <NumberFieldRootReplace ref={fixture} swapped={swapped.value} />);
      expect(screen.queryByTestId('error')).toBe(null);

      swapped.value = true;
      await flushMicrotasks();
      fixture.value!.validate();
      await flushMicrotasks();

      expect(screen.getByTestId('error')).toHaveTextContent('Enter a number');
    });

    it('keeps the root that mounted last as the input of the field when an earlier root renders again', async () => {
      const showSecond = shallowRef(false);
      const step = shallowRef(1);
      let field = null as FieldRootInstance | null;
      await render(() => (
        <Field.Root
          ref={(instance) => {
            field = instance as FieldRootInstance | null;
          }}
        >
          <NumberField.Root step={step.value} />
          {showSecond.value ? <NumberField.Root required /> : null}
          <Field.Error match="valueMissing" data-testid="error">
            Enter a number
          </Field.Error>
        </Field.Root>
      ));
      showSecond.value = true;
      await flushMicrotasks();
      // The first root patches its input again, with the same element.
      step.value = 2;
      await flushMicrotasks();
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
      const format = { minimumFractionDigits: 2 };
      const props = { defaultValue: 1234.5, format };
      const serverHtml = await renderOnServer(file, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(template.content.querySelector('[data-testid="text"]')?.textContent).toBe(
        new Intl.NumberFormat('en-US', format).format(1234.5),
      );
      mockRuntimeLocale('de-DE');

      const { container } = await hydrate(NumberFieldRootHydration, { serverHtml, props });

      expect(container.querySelector('[data-testid="text"]')?.textContent).toBe(
        new Intl.NumberFormat('de-DE', format).format(1234.5),
      );
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

  it('blocks submission when step mismatch occurs', async () => {
    await render(
      <form data-testid="form">
        <NumberField.Root name="quantity" min={0} step={0.1}>
          <NumberField.Group>
            <NumberField.Input />
          </NumberField.Group>
        </NumberField.Root>
        <button type="submit">Submit</button>
      </form>,
    );

    const input = screen.getByRole('textbox');
    await fireEvent.input(input, { target: { value: '0.11' } });

    const hiddenInput = document.querySelector(
      'input[type="number"][name="quantity"]',
    ) as HTMLInputElement;
    expect(hiddenInput).not.toBe(null);
    expect(hiddenInput.validity.stepMismatch).toBe(true);

    const form = screen.getByTestId<HTMLFormElement>('form');
    expect(form.checkValidity()).toBe(false);
  });

  it.skipIf(isJSDOM)('blocks submission when step mismatch occurs with default step', async () => {
    await render(
      <form data-testid="form">
        <NumberField.Root name="quantity" min={0}>
          <NumberField.Group>
            <NumberField.Input />
          </NumberField.Group>
        </NumberField.Root>
        <button type="submit">Submit</button>
      </form>,
    );

    const input = screen.getByRole('textbox');
    await fireEvent.input(input, { target: { value: '0.11' } });

    const hiddenInput = document.querySelector(
      'input[type="number"][name="quantity"]',
    ) as HTMLInputElement;
    expect(hiddenInput).not.toBe(null);
    expect(hiddenInput.validity.stepMismatch).toBe(true);

    const form = screen.getByTestId<HTMLFormElement>('form');
    expect(form.checkValidity()).toBe(false);
  });

  it('does not block submission when step="any"', async () => {
    await render(
      <form data-testid="form">
        <NumberField.Root name="quantity" min={0} step="any">
          <NumberField.Group>
            <NumberField.Input />
          </NumberField.Group>
        </NumberField.Root>
        <button type="submit">Submit</button>
      </form>,
    );

    const input = screen.getByRole('textbox');
    await fireEvent.input(input, { target: { value: '0.11' } });

    const hiddenInput = document.querySelector(
      'input[type="number"][name="quantity"]',
    ) as HTMLInputElement;
    expect(hiddenInput).not.toBe(null);
    expect(hiddenInput.validity.stepMismatch).toBe(false);

    const form = screen.getByTestId<HTMLFormElement>('form');
    expect(form.checkValidity()).toBe(true);
  });

  describe('prop: readOnly', () => {
    it('keeps focus state in sync on a readOnly field', async () => {
      await render(
        <Field.Root>
          <NumberField.Root readOnly>
            <NumberField.Input data-testid="input" />
          </NumberField.Root>
        </Field.Root>,
      );
      const input = screen.getByTestId('input');

      await fireEvent.focusIn(input);
      expect(input).toHaveAttribute('data-focused', '');

      await fireEvent.focusOut(input);
      expect(input).not.toHaveAttribute('data-focused');
    });
  });

  describe('prop: allowOutOfRange', () => {
    it('allows range overflow validation when true', async () => {
      await render(
        <form data-testid="form">
          <NumberField.Root name="quantity" max={5} allowOutOfRange>
            <NumberField.Group>
              <NumberField.Input />
            </NumberField.Group>
          </NumberField.Root>
          <button type="submit">Submit</button>
        </form>,
      );

      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '6' } });

      const hiddenInput = document.querySelector(
        'input[type="number"][name="quantity"]',
      ) as HTMLInputElement;

      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput.value).toBe('6');
      expect(hiddenInput.validity.rangeOverflow).toBe(true);

      const form = screen.getByTestId<HTMLFormElement>('form');
      expect(form.checkValidity()).toBe(false);
    });

    it('clamps to range when false', async () => {
      await render(
        <form data-testid="form">
          <NumberField.Root name="quantity" max={5} allowOutOfRange={false}>
            <NumberField.Group>
              <NumberField.Input />
            </NumberField.Group>
          </NumberField.Root>
          <button type="submit">Submit</button>
        </form>,
      );

      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '6' } });

      const hiddenInput = document.querySelector(
        'input[type="number"][name="quantity"]',
      ) as HTMLInputElement;

      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput.value).toBe('5');
      expect(hiddenInput.validity.rangeOverflow).toBe(false);

      const form = screen.getByTestId<HTMLFormElement>('form');
      expect(form.checkValidity()).toBe(true);
    });
  });

  describe('Form', () => {
    it('should include the input value in the form submission', async () => {
      let fieldValue = '';

      await render(
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget as HTMLFormElement);
            fieldValue = formData.get('test') as string;
          }}
        >
          <Field.Root name="test">
            <NumberField.Root defaultValue={undefined}>
              <NumberField.Input />
            </NumberField.Root>
            <button type="submit">Submit</button>
          </Field.Root>
        </Form>,
      );

      const submitButton = screen.getByText('Submit');
      submitButton.click();
      await flushMicrotasks();
      expect(fieldValue).toBe('');

      await fireEvent.input(screen.getByRole('textbox'), { target: { value: '50' } });
      submitButton.click();
      await flushMicrotasks();
      expect(fieldValue).toBe('50');
    });

    it('should not include formatting in the submitted value', async () => {
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };

      let fieldValue = '';

      await render(
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget as HTMLFormElement);
            fieldValue = formData.get('test') as string;
          }}
        >
          <Field.Root name="test">
            <NumberField.Root defaultValue={54.5} format={format} locale="de-DE">
              <NumberField.Input />
            </NumberField.Root>
            <button type="submit">Submit</button>
          </Field.Root>
        </Form>,
      );

      const input = screen.getByRole('textbox');
      const expectedValue = new Intl.NumberFormat('de-DE', format).format(54.5);
      expect(input).toHaveValue(expectedValue);

      const submitButton = screen.getByText('Submit');

      submitButton.click();
      await flushMicrotasks();

      expect(fieldValue).toBe('54.5');
    });

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      let fieldValue = '';

      await render(
        <>
          <form
            id="external-form"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget as HTMLFormElement);
              fieldValue = formData.get('test') as string;
            }}
          >
            <button type="submit">Submit</button>
          </form>
          <NumberField.Root name="test" form="external-form" defaultValue={54.5}>
            <NumberField.Input />
          </NumberField.Root>
        </>,
      );

      screen.getByText('Submit').click();
      await flushMicrotasks();

      expect(fieldValue).toBe('54.5');
    });

    it.skipIf(isJSDOM)('only validates the form specified by `form`', async () => {
      const onParentSubmit = vi.fn((event: Event) => {
        event.preventDefault();
      });
      const onExternalSubmit = vi.fn((event: Event) => {
        event.preventDefault();
        return new FormData(event.currentTarget as HTMLFormElement).getAll('quantity');
      });
      const { user } = await render(
        <>
          <form id="external-form" onSubmit={onExternalSubmit}>
            <button type="submit">Submit external</button>
          </form>
          <form onSubmit={onParentSubmit}>
            <NumberField.Root name="quantity" form="external-form" required>
              <NumberField.Input />
            </NumberField.Root>
            <button type="submit">Submit parent</button>
          </form>
        </>,
      );

      await user.click(screen.getByRole('button', { name: 'Submit parent' }));
      expect(onParentSubmit).toHaveBeenCalledOnce();

      await user.click(screen.getByRole('button', { name: 'Submit external' }));
      expect(onExternalSubmit).not.toHaveBeenCalled();

      await user.type(screen.getByRole('textbox'), '12');
      await user.click(screen.getByRole('button', { name: 'Submit external' }));
      expect(onExternalSubmit).toHaveBeenCalledOnce();
      expect(onExternalSubmit).toHaveReturnedWith(['12']);
    });

    it('updates both input form owners when `form` changes or is removed', async () => {
      let root: { inputElement: HTMLInputElement | null } | null = null;
      const TestCase = defineComponent({
        props: { form: { type: String, default: undefined } },
        setup(props) {
          return () => (
            <>
              <form id="first-form" data-testid="first-form" />
              <form id="second-form" data-testid="second-form" />
              <form data-testid="parent-form">
                <NumberField.Root
                  form={props.form}
                  ref={(instance) => {
                    root = instance as { inputElement: HTMLInputElement | null } | null;
                  }}
                >
                  <NumberField.Input />
                </NumberField.Root>
              </form>
            </>
          );
        },
      });

      const { rerender } = await render(<TestCase form="first-form" />);
      const input = screen.getByRole<HTMLInputElement>('textbox');
      expect(input.form).toBe(screen.getByTestId('first-form'));
      expect(root!.inputElement?.form).toBe(input.form);

      await rerender(<TestCase form="second-form" />);
      expect(input.form).toBe(screen.getByTestId('second-form'));
      expect(root!.inputElement?.form).toBe(input.form);

      await rerender(<TestCase />);
      expect(input.form).toBe(screen.getByTestId('parent-form'));
      expect(root!.inputElement?.form).toBe(input.form);
    });

    it('should handle browser autofill', async () => {
      const onValueChange = vi.fn();

      await render(
        <Field.Root name="quantity">
          <NumberField.Root onValueChange={onValueChange}>
            <NumberField.Input />
          </NumberField.Root>
        </Field.Root>,
      );

      const input = screen.getByRole('textbox');
      const hiddenInput = document.querySelector('input[type="number"][name="quantity"]');

      expect(hiddenInput).not.toBe(null);
      await fireEvent.change(hiddenInput!, { target: { value: '42' } });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(42);
      expect(input).toHaveValue('42');
    });

    it('validates the parsed number when handling browser autofill', async () => {
      const validate = vi.fn((_value: unknown) => null);

      await render(
        <Field.Root name="quantity" validationMode="onChange" validate={validate}>
          <NumberField.Root>
            <NumberField.Input />
          </NumberField.Root>
        </Field.Root>,
      );

      const hiddenInput = document.querySelector('input[type="number"][name="quantity"]');

      expect(hiddenInput).not.toBe(null);
      await fireEvent.change(hiddenInput!, { target: { value: '42' } });

      expect(validate).toHaveBeenCalled();
      expect(validate.mock.calls.every(([value]) => value === 42)).toBe(true);
      expect(validate.mock.lastCall?.[0]).toBe(42);
    });

    it.each([
      { lockState: 'readOnly', ariaInvalid: 'true' },
      { lockState: 'disabled', ariaInvalid: null },
    ] as const)(
      'ignores hidden-input autofill when $lockState inside Field',
      async ({ lockState, ariaInvalid }) => {
        const onValueChange = vi.fn();

        await render(
          <Form errors={{ quantity: 'test' }}>
            <Field.Root name="quantity">
              <NumberField.Root
                defaultValue={1}
                readOnly={lockState === 'readOnly'}
                disabled={lockState === 'disabled'}
                onValueChange={onValueChange}
              >
                <NumberField.Input />
              </NumberField.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );

        const input = screen.getByRole('textbox');
        const hiddenInput = document.querySelector(
          'input[type="number"][name="quantity"]',
        ) as HTMLInputElement;

        expect(hiddenInput).not.toBe(null);
        expect(screen.getByTestId('error')).toHaveTextContent('test');
        // A disabled control is not marked invalid.
        expect(input.getAttribute('aria-invalid')).toBe(ariaInvalid);

        await fireEvent.change(hiddenInput, { target: { value: '42' } });

        expect(onValueChange).not.toHaveBeenCalled();
        expect(input).toHaveValue('1');
        expect(screen.getByTestId('error')).toHaveTextContent('test');
      },
    );

    it.each([{ lockState: 'readOnly' }, { lockState: 'disabled' }] as const)(
      'ignores hidden-input autofill when $lockState outside Field',
      async ({ lockState }) => {
        const onValueChange = vi.fn();

        await render(
          <NumberField.Root
            name="quantity"
            defaultValue={1}
            readOnly={lockState === 'readOnly'}
            disabled={lockState === 'disabled'}
            onValueChange={onValueChange}
          >
            <NumberField.Input />
          </NumberField.Root>,
        );

        const input = screen.getByRole('textbox');
        const hiddenInput = document.querySelector(
          'input[type="number"][name="quantity"]',
        ) as HTMLInputElement;

        expect(hiddenInput).not.toBe(null);

        await fireEvent.change(hiddenInput, { target: { value: '42' } });

        expect(onValueChange).not.toHaveBeenCalled();
        expect(input).toHaveValue('1');
      },
    );
  });

  describe('Field', () => {
    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <NumberField.Root>
            <NumberField.Input />
          </NumberField.Root>
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);

      expect(input).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      await render(
        <Field.Root>
          <NumberField.Root>
            <NumberField.Input />
          </NumberField.Root>
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(input).not.toHaveAttribute('data-dirty');

      await fireEvent.input(input, { target: { value: '1' } });

      expect(input).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when filled', async () => {
        await render(
          <Field.Root>
            <NumberField.Root>
              <NumberField.Input data-testid="input" />
            </NumberField.Root>
          </Field.Root>,
        );

        const input = screen.getByTestId('input');

        expect(input).not.toHaveAttribute('data-filled');

        await fireEvent.input(input, { target: { value: '1' } });

        expect(input).toHaveAttribute('data-filled', '');

        await fireEvent.input(input, { target: { value: '' } });

        expect(input).not.toHaveAttribute('data-filled');
      });

      it('has [data-filled] attribute when already filled', async () => {
        await render(
          <Field.Root>
            <NumberField.Root defaultValue={1}>
              <NumberField.Input data-testid="input" />
            </NumberField.Root>
          </Field.Root>,
        );

        const input = screen.getByTestId('input');

        expect(input).toHaveAttribute('data-filled');

        await fireEvent.input(input, { target: { value: '' } });

        expect(input).not.toHaveAttribute('data-filled');
      });
    });

    it('[data-filled]', async () => {
      await render(
        <Field.Root>
          <NumberField.Root>
            <NumberField.Input data-testid="input" />
          </NumberField.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('data-focused');

      await fireEvent.focusIn(input);

      expect(input).toHaveAttribute('data-focused', '');

      await fireEvent.focusOut(input);

      expect(input).not.toHaveAttribute('data-focused');
    });

    it('adds [data-focused] attribute on every focus', async () => {
      await render(
        <Field.Root>
          <NumberField.Root>
            <NumberField.Input data-testid="input" />
          </NumberField.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      await fireEvent.focusIn(input);
      expect(input).toHaveAttribute('data-focused', '');

      await fireEvent.focusOut(input);
      expect(input).not.toHaveAttribute('data-focused');

      await fireEvent.focusIn(input);
      expect(input).toHaveAttribute('data-focused', '');
    });

    describe('[data-focused] without a blur event', () => {
      function NumberFields(props: { firstMounted?: boolean; firstDisabled?: boolean }) {
        const { firstMounted = true, firstDisabled = false } = props;
        return (
          <Field.Root data-testid="root">
            {firstMounted && (
              <NumberField.Root disabled={firstDisabled}>
                <NumberField.Input data-testid="first" />
              </NumberField.Root>
            )}
          </Field.Root>
        );
      }

      it('is removed when the focused input becomes disabled', async () => {
        const { setProps } = await render(<NumberFields />);

        const input = screen.getByTestId('first');
        input.focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
        expect(input).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused input unmounts', async () => {
        const { setProps } = await render(<NumberFields />);

        screen.getByTestId('first').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      });
    });

    it('prop: validate', async () => {
      await render(
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <NumberField.Root>
            <NumberField.Input />
          </NumberField.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const input = screen.getByRole('textbox');

      expect(input).not.toHaveAttribute('aria-invalid');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    describe('prop: validationMode', () => {
      it('onSubmit', async () => {
        await render(
          <Form>
            <Field.Root validate={(value) => (value === 1 ? 'custom error' : null)}>
              <NumberField.Root required data-testid="root">
                <NumberField.Input data-testid="input" />
              </NumberField.Root>
              <Field.Error data-testid="error" match="valueMissing">
                valueMissing error
              </Field.Error>
              <Field.Error data-testid="error" match="customError" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const input = screen.getByRole('textbox');
        expect(input).not.toHaveAttribute('aria-invalid');

        await fireEvent.input(input, { target: { value: '1' } });
        await fireEvent.focusOut(input);
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        await fireEvent.input(input, { target: { value: '' } });
        await fireEvent.focusOut(input);
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        await fireEvent.click(screen.getByText('submit'));
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).toHaveTextContent('valueMissing error');
        expect(screen.getByTestId('root')).toHaveAttribute('data-invalid');
        expect(input).toHaveAttribute('data-invalid');

        await fireEvent.input(input, { target: { value: '2' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
        expect(input).not.toHaveAttribute('data-invalid');
        expect(screen.getByTestId('root')).toHaveAttribute('data-valid');
        expect(input).toHaveAttribute('data-valid');
        // re-invalidate the field value
        await fireEvent.input(input, { target: { value: '1' } });
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).toHaveTextContent('custom error');

        await fireEvent.input(input, { target: { value: '3' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        await fireEvent.input(input, { target: { value: '' } });
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).toHaveTextContent('valueMissing error');
      });

      it('onChange', async () => {
        await render(
          <Field.Root
            validationMode="onChange"
            validate={(value) => {
              return value === 1 ? 'error' : null;
            }}
          >
            <NumberField.Root>
              <NumberField.Input data-testid="input" />
            </NumberField.Root>
          </Field.Root>,
        );

        const input = screen.getByTestId('input');

        expect(input).not.toHaveAttribute('aria-invalid');

        await fireEvent.input(input, { target: { value: '1' } });

        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('revalidates when the controlled value changes externally', async () => {
        const validateSpy = vi.fn((value: unknown) =>
          (value as number | null) === 5 ? 'error' : null,
        );

        const App = defineComponent(() => {
          const value = shallowRef<number | null>(null);

          return () => (
            <>
              <Field.Root validationMode="onChange" validate={validateSpy} name="quantity">
                <NumberField.Root
                  value={value.value}
                  onValueChange={(next) => {
                    value.value = next;
                  }}
                >
                  <NumberField.Input data-testid="input" />
                </NumberField.Root>
              </Field.Root>
              <button
                type="button"
                onClick={() => {
                  value.value = 5;
                }}
              >
                Set externally
              </button>
            </>
          );
        });

        await render(<App />);

        const input = screen.getByTestId('input');
        const toggle = screen.getByText('Set externally');

        expect(input).not.toHaveAttribute('aria-invalid');
        const initialCallCount = validateSpy.mock.calls.length;

        await fireEvent.click(toggle);

        expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
        expect(validateSpy.mock.lastCall?.[0]).toBe(5);
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('onBlur', async () => {
        await render(
          <Field.Root
            validationMode="onBlur"
            validate={(value) => {
              return value === 1 ? 'error' : null;
            }}
          >
            <NumberField.Root required>
              <NumberField.Input data-testid="input" />
            </NumberField.Root>
            <Field.Error data-testid="error" />
          </Field.Root>,
        );

        const input = screen.getByTestId('input');
        expect(input).not.toHaveAttribute('aria-invalid');

        await fireEvent.input(input, { target: { value: '1' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        await fireEvent.focusOut(input);
        expect(input).toHaveAttribute('aria-invalid', 'true');
        // revalidation
        await fireEvent.input(input, { target: { value: '2' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
      });
    });

    it('prevents form submission when the value does not match the step', async () => {
      const handleSubmit = vi.fn((event: Event) => event.preventDefault());
      await render(
        <form onSubmit={handleSubmit}>
          <NumberField.Root name="quantity" defaultValue={0} min={0} step={0.1}>
            <NumberField.Input data-testid="input" />
          </NumberField.Root>
          <button type="submit">submit</button>
        </form>,
      );

      const input = screen.getByTestId('input');

      input.focus();
      await flushMicrotasks();

      await fireEvent.input(input, { target: { value: '0.11' } });
      await fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit.mock.calls.length).toBe(0);

      await fireEvent.input(input, { target: { value: '0.1' } });
      await fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit.mock.calls.length).toBe(1);
      expect(
        new FormData(handleSubmit.mock.calls[0][0].target as HTMLFormElement).get('quantity'),
      ).toBe('0.1');
    });

    it('prevents Form/Field submission when the value does not match the step', async () => {
      const handleSubmit = vi.fn();
      await render(
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="quantity">
            <NumberField.Root defaultValue={0} min={0} step={0.1}>
              <NumberField.Input data-testid="input" />
            </NumberField.Root>
            <Field.Error match="stepMismatch" data-testid="error">
              step mismatch
            </Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');

      input.focus();
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);

      await fireEvent.input(input, { target: { value: '0.11' } });
      await fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit.mock.calls.length).toBe(0);
      expect(screen.getByTestId('error')).toHaveTextContent('step mismatch');

      await fireEvent.input(input, { target: { value: '0.1' } });
      await fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit.mock.calls.length).toBe(1);
      expect(handleSubmit.mock.calls[0][0].quantity).toBe(0.1);
    });

    it('disables the input when disabled=true', async () => {
      await render(
        <Field.Root disabled>
          <NumberField.Root>
            <NumberField.Input />
          </NumberField.Root>
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(input).toHaveAttribute('disabled', '');
    });

    it('does not disable the input when disabled=false', async () => {
      await render(
        <Field.Root disabled={false}>
          <NumberField.Root>
            <NumberField.Input />
          </NumberField.Root>
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(input).not.toHaveAttribute('disabled');
    });

    it('is validated with latest value when validationMode=onBlur', async () => {
      const validate = vi.fn((..._args: unknown[]) => 'error');

      await render(
        <Form>
          <Field.Root validationMode="onBlur" validate={validate} name="quantity">
            <NumberField.Root defaultValue={undefined}>
              <NumberField.Input />
            </NumberField.Root>
          </Field.Root>
        </Form>,
      );

      const input = screen.getByRole('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: '1' } });
      await fireEvent.focusOut(input);

      expect(validate.mock.calls.length).toBe(1);
      expect(validate.mock.calls[0]).toEqual([1, { quantity: 1 }]);
    });

    it('is validated with clamped value when validationMode=onBlur', async () => {
      const validate = vi.fn((..._args: unknown[]) => null);

      await render(
        <Form>
          <Field.Root validationMode="onBlur" validate={validate} name="quantity">
            <NumberField.Root max={10}>
              <NumberField.Input />
            </NumberField.Root>
          </Field.Root>
        </Form>,
      );

      const input = screen.getByRole('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: '1000' } });
      await fireEvent.focusOut(input);

      expect(validate.mock.calls.length).toBe(1);
      expect(validate.mock.calls[0]).toEqual([10, { quantity: 10 }]);
      expect(input).toHaveValue('10');
    });

    it('revalidates an external change after a blur that normalizes back to the current value', async () => {
      const validate = (value: unknown) => (value === 5 ? 'error' : null);

      const App = defineComponent(() => {
        const value = shallowRef<number | null>(5);
        return () => (
          <Form>
            <Field.Root validationMode="onBlur" validate={validate} name="quantity">
              <NumberField.Root
                value={value.value}
                onValueChange={(next) => {
                  value.value = next;
                }}
                max={5}
              >
                <NumberField.Input />
              </NumberField.Root>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                value.value = 3;
              }}
            >
              external
            </button>
          </Form>
        );
      });

      const { user } = await render(<App />);
      const input = screen.getByRole('textbox');

      // Blur after typing a value that clamps back to the current value (5). This sets the
      // internal block-revalidation flag and commits an error, but since the stored value is
      // unchanged `useValueChanged` won't fire to reset the flag.
      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: '9' } });
      await fireEvent.focusOut(input);
      expect(input).toHaveValue('5');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      // The flag must have been reset on blur so the next external change revalidates and
      // clears the error rather than being swallowed.
      await user.click(screen.getByText('external'));
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('Field.Label', async () => {
      await render(
        <Field.Root>
          <NumberField.Root>
            <NumberField.Input />
          </NumberField.Root>
          <Field.Label data-testid="label" />
        </Field.Root>,
      );

      expect(screen.getByTestId('label')).toHaveAttribute('for', screen.getByRole('textbox').id);
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <NumberField.Root>
            <NumberField.Input aria-describedby="external-description" />
          </NumberField.Root>
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      expect(screen.getByRole('textbox')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  describe('hidden input', () => {
    it('keeps a selection the consumer sets in onFocus when forwarding focus', async () => {
      await render(
        <NumberField.Root defaultValue={100}>
          <NumberField.Input
            onFocusin={(event) => (event.currentTarget as HTMLInputElement).select()}
          />
        </NumberField.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      getHiddenInput().focus();
      await flushMicrotasks();

      expect(input).toHaveFocus();
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });
  });
});
