import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, h, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { NumberField as NumberFieldBase } from '@vase-ui/vue/number-field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hiddenInputSizeTests,
  hydrate,
  isJSDOM,
  mockRuntimeLocale,
  pasteText,
  renderOnServer,
  screen,
} from '#test-utils';
import NumberFieldContextProbe from '../../../test/fixtures/NumberFieldContextProbe.vue';
import { REASONS } from '../../internals/reasons';
import NumberFieldRootHydration from './NumberFieldRootHydration.test.vue';
import NumberFieldRootReplace from './NumberFieldRootReplace.test.vue';

type FieldRootInstance = InstanceType<typeof Field.Root>;
type NumberFieldRootInstance = InstanceType<typeof NumberFieldBase.Root>;

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

// A case that reads the context of the root renders the probe with `probe` as its ref.
function createProbe() {
  const probe = shallowRef<InstanceType<typeof NumberFieldContextProbe> | null>(null);
  return { probe, getContext: () => probe.value!.context };
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

  describeConformance(<NumberFieldBase.Root />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  hiddenInputSizeTests({
    render,
    createComponent: (props) => (
      <NumberFieldBase.Root {...props}>
        <NumberFieldBase.Input />
      </NumberFieldBase.Root>
    ),
  });

  type NumberFieldProps = NumberFieldRootInstance['$props'];

  // The helper of Base UI also renders `ScrubArea`. This helper renders only the parts that Vase UI
  // has.
  function NumberField(props: NumberFieldProps) {
    return (
      <NumberFieldBase.Root {...props}>
        <NumberFieldBase.Group>
          <NumberFieldBase.Input />
          <NumberFieldBase.Increment />
          <NumberFieldBase.Decrement />
        </NumberFieldBase.Group>
      </NumberFieldBase.Root>
    );
  }

  describe('hidden input size', () => {
    it('keeps the 1px size in the next render of the root', async () => {
      const { container } = await render(<NumberFieldBase.Root required />);
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
      await render(<NumberFieldBase.Root />);
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
      await render(<NumberFieldBase.Root {...props} />);

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
      await render(<NumberFieldBase.Root {...props} />);

      expect(getHiddenInput().value).toBe(text);
      expect(getHiddenInput().getAttribute('value')).toBe(text);
    });

    it('is the `inputElement` that the root exposes', async () => {
      let root = null as NumberFieldRootInstance | null;
      await render(() => (
        <NumberFieldBase.Root
          ref={(instance) => {
            root = instance as NumberFieldRootInstance | null;
          }}
        />
      ));

      expect(root!.inputElement).toBe(getHiddenInput());
    });

    it('follows a controlled value', async () => {
      const { setProps } = await render(<NumberFieldBase.Root value={1} />);

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
        <NumberFieldBase.Root
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
      await render(<NumberFieldBase.Root onValueChange={handleChange} />);

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
        <NumberFieldBase.Root
          defaultValue={5}
          onValueChange={(
            _value: number | null,
            details: NumberFieldBase.Root.ChangeEventDetails,
          ) => details.cancel()}
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
      await render(<NumberFieldBase.Root onValueChange={handleChange} />);

      await autofill('42');

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.calls[0][0]).toBe(42);
    });

    it('changes the value for a `change` event that has no `input` event', async () => {
      const handleChange = vi.fn();
      await render(<NumberFieldBase.Root onValueChange={handleChange} />);

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
            <NumberFieldBase.Root
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
          <NumberFieldBase.Root max={10} onValueChange={handleChange} />
        ),
        filled: '70',
        changes: [10],
        text: '10',
      },
      {
        name: 'a change that a listener cancels',
        renderField: (handleChange: (value: number | null) => void) => () => (
          <NumberFieldBase.Root
            onValueChange={(
              value: number | null,
              details: NumberFieldBase.Root.ChangeEventDetails,
            ) => {
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
        <NumberFieldBase.Root
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
          <NumberFieldBase.Root defaultValue={5} />
        </Field.Root>,
      );

      await fireEvent.change(getHiddenInput());

      expect(validate).not.toHaveBeenCalled();
    });

    it('empties the value when the hidden input gets no value', async () => {
      const handleChange = vi.fn();
      await render(<NumberFieldBase.Root defaultValue={5} onValueChange={handleChange} />);

      await fireEvent.change(getHiddenInput(), { target: { value: '' } });

      expect(handleChange.mock.lastCall?.[0]).toBe(null);
      expect(getHiddenInput().value).toBe('');
    });

    it('ignores an autofill that a listener prevented', async () => {
      const handleChange = vi.fn();
      const { container } = await render(
        <NumberFieldBase.Root defaultValue={1} onValueChange={handleChange} />,
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
      await render(
        <NumberFieldBase.Root defaultValue={1} onValueChange={handleChange} {...props} />,
      );

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
      await render(<NumberFieldBase.Root onValueChange={handleChange} {...props} />);

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
          <NumberFieldBase.Root />
        </Field.Root>,
      );

      await autofill('42');

      expect(validate.mock.calls.map(([value]) => value)).toEqual([42]);
    });

    it('validates the number that the field stores, not the number that the autofill gives', async () => {
      const validate = vi.fn((_value: unknown) => null);
      await render(
        <Field.Root name="quantity" validationMode="onChange" validate={validate}>
          <NumberFieldBase.Root max={10} />
        </Field.Root>,
      );

      await autofill('70');

      expect(validate.mock.calls.map(([value]) => value)).toEqual([10]);
    });

    it('validates the number of an autofill that a listener cancels', async () => {
      const validate = vi.fn((_value: unknown) => null);
      await render(
        <Field.Root name="quantity" validationMode="onChange" validate={validate}>
          <NumberFieldBase.Root
            onValueChange={(
              _value: number | null,
              details: NumberFieldBase.Root.ChangeEventDetails,
            ) => details.cancel()}
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
            <NumberFieldBase.Root />
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
        <NumberFieldBase.Root
          defaultValue={5}
          onValueChange={(
            _value: number | null,
            details: NumberFieldBase.Root.ChangeEventDetails,
          ) => details.cancel()}
        />,
      );

      await autofill('7');

      expect(getHiddenInput().value).toBe('5');
    });

    it('after an autofill that the parent of a controlled field does not accept', async () => {
      const handleUpdate = vi.fn();
      await render(<NumberFieldBase.Root value={5} {...{ 'onUpdate:value': handleUpdate }} />);

      await autofill('7');

      expect(handleUpdate.mock.calls).toEqual([[7]]);
      expect(getHiddenInput().value).toBe('5');
    });

    it('after a `pageshow` event, because a browser can restore the form state after the mount', async () => {
      const handleChange = vi.fn();
      await render(<NumberFieldBase.Root defaultValue={5} onValueChange={handleChange} />);
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
          <NumberFieldBase.Root name="quantity" {...props} />
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
          <NumberFieldBase.Root name="quantity" defaultValue={3} {...props} />
        </form>,
      );

      expect(Array.from(new FormData(screen.getByTestId<HTMLFormElement>('form')))).toEqual([]);
    });

    it('submits to the form that the `form` prop names', async () => {
      await render(
        <div>
          <form data-testid="form" id="external" />
          <form data-testid="parent">
            <NumberFieldBase.Root name="quantity" form="external" defaultValue={54.5} />
          </form>
        </div>,
      );

      expect(getFormData()).toEqual(['54.5']);
      expect(
        new FormData(screen.getByTestId<HTMLFormElement>('parent')).getAll('quantity'),
      ).toEqual([]);
    });

    it('does not submit a required field with no value, and focuses the text input', async () => {
      const handleSubmit = vi.fn((event: Event) => event.preventDefault());
      const { user } = await render(
        <form data-testid="form" onSubmit={handleSubmit}>
          <NumberFieldBase.Root name="quantity" required>
            <NumberFieldBase.Input data-testid="text" />
          </NumberFieldBase.Root>
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
          <NumberFieldBase.Root name="quantity" required readOnly />
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
              <NumberFieldBase.Root
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
            <NumberFieldBase.Root defaultValue={5} onValueChange={handleChange} />
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
                <NumberFieldBase.Root
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
              <NumberFieldBase.Root
                name="quantity"
                defaultValue={1}
                onValueChange={(
                  _value: number | null,
                  details: NumberFieldBase.Root.ChangeEventDetails,
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
              <NumberFieldBase.Root name="quantity" defaultValue={1} />
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
                <NumberFieldBase.Root name="quantity" defaultValue={1} />
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
              <NumberFieldBase.Root name="quantity" form="other" defaultValue={1} />
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
            <NumberFieldBase.Root name="quantity" form="external" defaultValue={2} />
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
        const { probe, getContext } = createProbe();
        await render(
          <form data-testid="form">
            <NumberFieldBase.Root name="quantity" defaultValue={1234.5}>
              <NumberFieldContextProbe ref={probe} />
            </NumberFieldBase.Root>
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
        const { probe, getContext } = createProbe();
        await render(
          <form data-testid="form">
            <NumberFieldBase.Root defaultValue={5}>
              <NumberFieldContextProbe ref={probe} />
            </NumberFieldBase.Root>
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
        const { probe, getContext } = createProbe();
        await render(
          <form data-testid="form">
            <NumberFieldBase.Root defaultValue={5}>
              <NumberFieldContextProbe
                ref={probe}
                onValueChanged={(context) => seen.push(context.isResetChangePending.value)}
              />
            </NumberFieldBase.Root>
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
          <NumberFieldBase.Root name="own" data-testid="root" />
        </Field.Root>,
      );

      expect(getHiddenInput().name).toBe('field');
      expect(getHiddenInput().disabled).toBe(true);
      expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');
    });

    it('gives `filled` and `dirty` to the field, and takes them back', async () => {
      await render(
        <Field.Root data-testid="field">
          <NumberFieldBase.Root data-testid="root" />
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
          <NumberFieldBase.Root required />
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
          <NumberFieldBase.Root step={step.value} />
          {showSecond.value ? <NumberFieldBase.Root required /> : null}
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
                <NumberFieldBase.Root />
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
                  <NumberFieldBase.Root
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
              <NumberFieldBase.Root defaultValue={1} />
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
              <NumberFieldBase.Root
                onValueChange={(
                  _value: number | null,
                  details: NumberFieldBase.Root.ChangeEventDetails,
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
                <NumberFieldBase.Root
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
      { name: 'a field at its maximum', props: { defaultValue: 9, max: 9 } },
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
                  <NumberFieldBase.Root key="field" name="quantity" defaultValue={1} />
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

  describe('prop: defaultValue', () => {
    it('should accept a number value', async () => {
      await render(<NumberField defaultValue={1} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('1');
    });

    it('should accept an `undefined` value', async () => {
      await render(<NumberField />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });
  });

  describe('prop: value', () => {
    it('should accept a number value that can change over time', async () => {
      const { rerender } = await render(<NumberField value={1} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('1');
      await rerender(<NumberField value={2} />);
      expect(input).toHaveValue('2');
    });

    it('should accept an `undefined` value', async () => {
      await render(<NumberField />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });

    it('should accept a `null` value', async () => {
      await render(<NumberField value={null} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });

    it('should be `null` when the input is empty but not trimmed', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField value={1} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '  ' } });
      expect(onValueChange.mock.calls[0][0]).toBe(null);
    });
  });

  it('blocks submission when step mismatch occurs', async () => {
    await render(
      <form data-testid="form">
        <NumberFieldBase.Root name="quantity" min={0} step={0.1}>
          <NumberFieldBase.Group>
            <NumberFieldBase.Input />
          </NumberFieldBase.Group>
        </NumberFieldBase.Root>
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
        <NumberFieldBase.Root name="quantity" min={0}>
          <NumberFieldBase.Group>
            <NumberFieldBase.Input />
          </NumberFieldBase.Group>
        </NumberFieldBase.Root>
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
        <NumberFieldBase.Root name="quantity" min={0} step="any">
          <NumberFieldBase.Group>
            <NumberFieldBase.Input />
          </NumberFieldBase.Group>
        </NumberFieldBase.Root>
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

  describe('prop: onValueChange', () => {
    it('should be called when the value changes', async () => {
      const onValueChange = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<number | null>(1);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(val) => {
              onValueChange(val);
              value.value = val;
            }}
          />
        );
      });
      await render(<App />);
      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '2' } });
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(2);
    });

    it('should be called with a number when transitioning from `null`', async () => {
      const onValueChange = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<number | null>(null);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(val) => {
              onValueChange(val);
              value.value = val;
            }}
          />
        );
      });
      await render(<App />);
      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '5' } });
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(5);
    });

    it('should be called with `null` when empty and transitioning from a number', async () => {
      const onValueChange = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<number | null>(5);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(val) => {
              onValueChange(val);
              value.value = val;
            }}
          />
        );
      });
      await render(<App />);
      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '' } });
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(null);
    });

    it('includes the reason for parseable typing', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      await fireEvent.input(input, { target: { value: '12' } });

      expect(onValueChange).toHaveBeenCalledTimes(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe(REASONS.inputChange);
    });

    it('includes the reason when clearing the value', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField defaultValue={5} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      await fireEvent.input(input, { target: { value: '' } });

      expect(onValueChange).toHaveBeenCalledTimes(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe(REASONS.inputClear);
    });

    it('includes the reason for keyboard increments', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField defaultValue={1} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      input.focus();
      await flushMicrotasks();
      await fireEvent.keyDown(input, { key: 'ArrowUp' });

      expect(onValueChange).toHaveBeenCalledTimes(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe('keyboard');
    });

    it('includes the reason for increment button presses', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField defaultValue={1} onValueChange={onValueChange} />);
      const incrementButton = screen.getByRole('button', { name: 'Increase' });

      await fireEvent.click(incrementButton);

      expect(onValueChange.mock.calls.length).toBe(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe('increment-press');
    });

    it('includes the reason for decrement button presses', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField defaultValue={1} onValueChange={onValueChange} />);
      const decrementButton = screen.getByRole('button', { name: 'Decrease' });

      await fireEvent.click(decrementButton);

      expect(onValueChange.mock.calls.length).toBe(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe('decrement-press');
    });

    it('includes the reason for wheel scrubbing', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField allowWheelScrub defaultValue={4} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      input.focus();
      await flushMicrotasks();
      await fireEvent.wheel(input, { deltaY: -100 });

      expect(onValueChange.mock.calls.length).toBe(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe('wheel');
    });
  });

  describe('typing behavior (parseable changes)', () => {
    it('fires onValueChange for each parseable change while typing', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await render(
        <NumberField onValueChange={onValueChange} onValueCommitted={onValueCommitted} />,
      );
      const input = screen.getByRole('textbox');

      // Type '1' -> parseable
      await fireEvent.input(input, { target: { value: '1' } });
      // Type '12' -> parseable
      await fireEvent.input(input, { target: { value: '12' } });
      // Type '12.' -> parseable (treated as 12)
      await fireEvent.input(input, { target: { value: '12.' } });
      // Type '12.a' -> not parseable, should not fire
      await fireEvent.input(input, { target: { value: '12.a' } });

      expect(onValueChange.mock.calls.length).toBe(3);
      expect(onValueChange.mock.calls[0][0]).toBe(1);
      expect(onValueChange.mock.calls[1][0]).toBe(12);
      expect(onValueChange.mock.calls[2][0]).toBe(12);

      expect(onValueCommitted.mock.calls.length).toBe(0);
    });

    it('does not fire onValueChange for non-numeric composition/partial input', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await render(
        <NumberField onValueChange={onValueChange} onValueCommitted={onValueCommitted} />,
      );
      const input = screen.getByRole('textbox');

      // Simulate IME composition of non-numeric text; intermediate values like 'ni'
      await fireEvent.compositionStart(input);
      await fireEvent.input(input, { target: { value: 'n' } });
      await fireEvent.input(input, { target: { value: 'ni' } });
      await fireEvent.compositionEnd(input);

      expect(onValueChange.mock.calls.length).toBe(0);

      // Now enter a Han numeral which is parseable
      await fireEvent.input(input, { target: { value: '一' } });
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(1);

      expect(onValueCommitted.mock.calls.length).toBe(0);
      await fireEvent.focusOut(input);
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(1);
    });

    it('handles sign and decimal partials vs. parseable numbers', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await render(
        <NumberField onValueChange={onValueChange} onValueCommitted={onValueCommitted} min={-10} />,
      );
      const input = screen.getByRole('textbox');

      // '-' or '.' alone aren't parseable
      await fireEvent.input(input, { target: { value: '-' } });
      await fireEvent.input(input, { target: { value: '.' } });
      // '0.' is parseable (-> 0)
      await fireEvent.input(input, { target: { value: '0.' } });
      await fireEvent.input(input, { target: { value: '-1' } });
      await fireEvent.input(input, { target: { value: '-1.5' } });

      expect(onValueChange.mock.calls.length).toBe(3);
      expect(onValueChange.mock.calls[0][0]).toBe(0);
      expect(onValueChange.mock.calls[1][0]).toBe(-1);
      expect(onValueChange.mock.calls[2][0]).toBe(-1.5);

      // No commit until blur
      expect(onValueCommitted.mock.calls.length).toBe(0);

      await fireEvent.focusOut(input);
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(-1.5);
    });

    it('allows typing a decimal while replacing a selection', async () => {
      await render(<NumberField defaultValue={12.3} locale="en-US" />);
      const input = screen.getByRole<HTMLInputElement>('textbox');

      input.focus();
      await flushMicrotasks();

      const decimalIndex = input.value.indexOf('.');
      expect(decimalIndex).toBeGreaterThan(-1);
      input.setSelectionRange(1, decimalIndex + 2);

      const keydownResult = await fireEvent.keyDown(input, { key: '.' });
      expect(keydownResult).toBe(true);
    });

    it('accepts grouping while typing and parses progressively', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      const groupSeparator =
        new Intl.NumberFormat().formatToParts(10000).find((part) => part.type === 'group')?.value ??
        '';
      expect(groupSeparator).not.toBe('');

      await render(
        <NumberField onValueChange={onValueChange} onValueCommitted={onValueCommitted} />,
      );
      const input = screen.getByRole('textbox');

      await fireEvent.input(input, { target: { value: '1' } }); // 1
      await fireEvent.input(input, { target: { value: `1${groupSeparator}` } }); // 1 (group symbol)
      await fireEvent.input(input, { target: { value: `1${groupSeparator}2` } }); // 12
      await fireEvent.input(input, { target: { value: `1${groupSeparator}23` } }); // 123
      await fireEvent.input(input, { target: { value: `1${groupSeparator}234` } }); // 1234

      expect(onValueChange.mock.calls.length).toBe(5);
      expect(onValueChange.mock.calls[0][0]).toBe(1);
      expect(onValueChange.mock.calls[1][0]).toBe(1);
      expect(onValueChange.mock.calls[2][0]).toBe(12);
      expect(onValueChange.mock.calls[3][0]).toBe(123);
      expect(onValueChange.mock.calls[4][0]).toBe(1234);

      expect(onValueCommitted.mock.calls.length).toBe(0);
      await fireEvent.focusOut(input);
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(1234);
    });

    it('respects locale decimal separator while typing (de-DE)', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await render(
        <NumberField
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          locale="de-DE"
        />,
      );
      const input = screen.getByRole('textbox');

      await fireEvent.input(input, { target: { value: '1' } }); // 1
      await fireEvent.input(input, { target: { value: '1,' } }); // 1 (decimal separator typed)
      await fireEvent.input(input, { target: { value: '1,5' } }); // 1.5

      expect(onValueChange.mock.calls.length).toBe(3);
      expect(onValueChange.mock.calls[0][0]).toBe(1);
      expect(onValueChange.mock.calls[1][0]).toBe(1);
      expect(onValueChange.mock.calls[2][0]).toBe(1.5);

      await fireEvent.focusOut(input);
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(1.5);
    });

    it('parses percent while typing and commits canonical percent value', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await render(
        <NumberField
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          format={{ style: 'percent' }}
        />,
      );
      const input = screen.getByRole('textbox');

      // Typing digits in percent style represents a fraction (12 -> 0.12)
      await fireEvent.input(input, { target: { value: '12' } });
      // Typing with explicit percent sign also remains 0.12
      await fireEvent.input(input, { target: { value: '12%' } });

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[0][0]).toBe(0.12);
      expect(onValueChange.mock.calls[1][0]).toBe(0.12);
      expect(onValueCommitted.mock.calls.length).toBe(0);

      await fireEvent.focusOut(input);
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(0.12);
    });

    it('parses an interleaved percent sign while typing (1%2 -> 12%)', async () => {
      const onValueCommitted = vi.fn();
      await render(
        <NumberField
          defaultValue={0.01}
          format={{ style: 'percent' }}
          locale="en-US"
          onValueCommitted={onValueCommitted}
        />,
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('1%');

      // Typing `2` after the rendered `1%` yields `1%2`, which must reformat to `12%` on blur.
      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: '1%2' } });
      await fireEvent.focusOut(input);

      expect(input).toHaveValue('12%');
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(0.12);
    });

    it('accepts currency symbol while typing and parses numeric value', async () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = { style: 'currency', currency: 'USD' };
      const formatter = new Intl.NumberFormat(undefined, format);
      const parts = formatter.formatToParts(12345);
      const groupSeparator = parts.find((part) => part.type === 'group')?.value ?? '';
      expect(groupSeparator).not.toBe('');

      function formatPartialValue(value: string) {
        let valueInserted = false;
        return parts
          .map((part) => {
            if (
              part.type === 'integer' ||
              part.type === 'group' ||
              part.type === 'decimal' ||
              part.type === 'fraction'
            ) {
              if (!valueInserted) {
                valueInserted = true;
                return value;
              }
              return '';
            }
            return part.value;
          })
          .join('');
      }

      await render(<NumberField onValueChange={onValueChange} format={format} />);
      const input = screen.getByRole('textbox');

      await fireEvent.input(input, { target: { value: formatPartialValue('1') } });
      await fireEvent.input(input, {
        target: { value: formatPartialValue(`1${groupSeparator}2`) },
      });

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[0][0]).toBe(1);
      expect(onValueChange.mock.calls[1][0]).toBe(12);
    });

    it('accepts multi-character currency symbols while typing (e.g. pt-BR BRL)', async () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = { style: 'currency', currency: 'BRL' };
      await render(
        <NumberField
          defaultValue={1234.56}
          locale="pt-BR"
          format={format}
          onValueChange={onValueChange}
        />,
      );
      const input = screen.getByRole('textbox');
      const formatted = new Intl.NumberFormat('pt-BR', format).format(1234.56);

      // Type a trailing digit. Previously every keystroke was rejected because the multi-character
      // `R$` symbol failed the per-character validation in the change handler.
      await fireEvent.input(input, { target: { value: `${formatted}7` } });

      expect(input).toHaveValue(`${formatted}7`);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(1234.567);
    });

    it('accepts multi-character unit symbols while typing (e.g. km/h)', async () => {
      const onValueChange = vi.fn();
      await render(
        <NumberField
          locale="en-US"
          format={{ style: 'unit', unit: 'kilometer-per-hour' }}
          onValueChange={onValueChange}
        />,
      );
      const input = screen.getByRole('textbox');

      // The `km/h` unit must not block editing the numeric region.
      await fireEvent.input(input, { target: { value: '1 km/h' } });
      await fireEvent.input(input, { target: { value: '12 km/h' } });

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[0][0]).toBe(1);
      expect(onValueChange.mock.calls[1][0]).toBe(12);
    });

    it('accepts exponent separators while typing (scientific notation)', async () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = { notation: 'scientific' };
      await render(<NumberField locale="en-US" format={format} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      // `1.5E3` should parse to 1500 rather than being rejected for the `E` separator.
      await fireEvent.input(input, { target: { value: '1.5E3' } });

      expect(input).toHaveValue('1.5E3');
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(1500);
    });

    it('ignores bidi/format control characters in the value (e.g. RTL exponent signs)', async () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = { notation: 'scientific' };
      await render(<NumberField locale="en-US" format={format} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      // RTL locales (e.g. fa-IR) insert a U+200E LEFT-TO-RIGHT MARK around the exponent sign in
      // scientific notation. Inject one into an otherwise-valid value so the test is deterministic
      // across ICU versions: the validator must ignore the control character rather than reject it.
      await fireEvent.input(input, { target: { value: '5E\u200E-1' } });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(0.5);
    });

    it('allows deleting trailing currency symbols with locale literals', async () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };
      const formatter = new Intl.NumberFormat('de-DE', format);

      await render(
        <NumberField
          defaultValue={12.34}
          locale="de-DE"
          format={format}
          onValueChange={onValueChange}
        />,
      );
      const input = screen.getByRole('textbox');
      const formatted = formatter.format(12.34);
      const withoutCurrency = formatted.replace('€', '');

      await fireEvent.input(input, { target: { value: withoutCurrency } });

      expect(input).toHaveValue(withoutCurrency);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(12.34);
    });

    it('allows backspace to remove trailing currency symbol that follows a locale literal', async () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };
      const formatter = new Intl.NumberFormat('de-DE', format);

      await render(
        <NumberField
          defaultValue={12.34}
          locale="de-DE"
          format={format}
          onValueChange={onValueChange}
        />,
      );

      const input = screen.getByRole('textbox');
      const formatted = formatter.format(12.34);
      const afterBackspace = formatted.slice(0, -1);

      input.focus();
      await flushMicrotasks();

      const keydownResult = await fireEvent.keyDown(input, { key: 'Backspace' });
      expect(keydownResult).toBe(true);

      await fireEvent.input(input, { target: { value: afterBackspace } });

      expect(input).toHaveValue(afterBackspace);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(12.34);
    });

    it('does not commit on blur for invalid input', async () => {
      const onValueCommitted = vi.fn();
      await render(<NumberField onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      await fireEvent.input(input, { target: { value: '.' } });
      expect(input).toHaveValue('.');
      await fireEvent.focusOut(input);

      expect(onValueCommitted.mock.calls.length).toBe(0);
    });
  });

  describe('prop: onValueCommitted', () => {
    it('fires on blur with committed numeric value', async () => {
      const onValueCommitted = vi.fn();
      await render(<NumberField onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: '123.' } });
      await fireEvent.focusOut(input);

      expect(onValueCommitted.mock.calls.length).toBe(1);
      // Canonicalizes to 123
      expect(onValueCommitted.mock.calls[0][0]).toBe(123);
    });

    it('fires null on blur when input is cleared', async () => {
      const onValueCommitted = vi.fn();
      await render(<NumberField defaultValue={5} onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: '' } });
      await fireEvent.focusOut(input);

      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(null);
    });

    it('reports and displays the clamped value on blur, not the raw input', async () => {
      const onValueCommitted = vi.fn();
      await render(<NumberField max={10} onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: '1000' } });
      await fireEvent.focusOut(input);

      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(10);
      expect(input).toHaveValue('10');
    });

    it('reports and displays the min-clamped value on blur, not the raw input', async () => {
      const onValueCommitted = vi.fn();
      await render(<NumberField min={0} onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: '-50' } });
      await fireEvent.focusOut(input);

      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(0);
      expect(input).toHaveValue('0');
    });

    it('fires on keyboard interactions (ArrowUp/Down/Home/End)', async () => {
      const onValueCommitted = vi.fn();
      await render(
        <NumberField defaultValue={0} min={-10} max={10} onValueCommitted={onValueCommitted} />,
      );

      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);

      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(onValueCommitted.mock.calls.length).toBe(2);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(0);

      await fireEvent.keyDown(input, { key: 'Home' });
      expect(onValueCommitted.mock.calls.length).toBe(3);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(-10);

      await fireEvent.keyDown(input, { key: 'End' });
      expect(onValueCommitted.mock.calls.length).toBe(4);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(10);
    });

    it('fires when using increment/decrement buttons', async () => {
      const onValueCommitted = vi.fn();
      await render(<NumberField defaultValue={0} onValueCommitted={onValueCommitted} />);

      const input = screen.getByRole('textbox');
      const inc = screen.getByLabelText('Increase');
      const dec = screen.getByLabelText('Decrease');

      await fireEvent.click(inc);
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);
      expect(input).toHaveValue('1');

      await fireEvent.click(dec);
      expect(onValueCommitted.mock.calls.length).toBe(2);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(0);
      expect(input).toHaveValue('0');
    });

    it('includes the correct reason for increment and decrement button presses', async () => {
      const onValueCommitted = vi.fn();
      await render(<NumberField defaultValue={0} onValueCommitted={onValueCommitted} />);

      const inc = screen.getByLabelText('Increase');
      const dec = screen.getByLabelText('Decrease');

      await fireEvent.click(inc);
      expect(onValueCommitted.mock.lastCall?.[1].reason).toBe(REASONS.incrementPress);

      await fireEvent.click(dec);
      expect(onValueCommitted.mock.lastCall?.[1].reason).toBe(REASONS.decrementPress);
    });

    it('does not fire when blurring an untouched empty field', async () => {
      const onValueCommitted = vi.fn();
      await render(<NumberField onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);

      expect(onValueCommitted.mock.calls.length).toBe(0);
    });

    it('does not fire on keyboard steps that do not change the value', async () => {
      const onValueCommitted = vi.fn();
      await render(
        <NumberField defaultValue={5} min={0} max={5} onValueCommitted={onValueCommitted} />,
      );
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(input, { key: 'ArrowUp' });
      await fireEvent.keyDown(input, { key: 'End' });
      expect(onValueCommitted.mock.calls.length).toBe(0);

      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(4);
    });

    it('fires once per press-release even after mouseleave/mouseenter during a hold', async () => {
      const onValueCommitted = vi.fn();
      await render(<NumberField defaultValue={0} onValueCommitted={onValueCommitted} />);
      const inc = screen.getByLabelText('Increase');

      await fireEvent.pointerDown(inc, { button: 0 });
      await fireEvent.mouseLeave(inc);
      await fireEvent.mouseEnter(inc, { buttons: 1 });
      await fireEvent.pointerUp(inc, { button: 0 });

      expect(onValueCommitted.mock.calls.length).toBe(1);
    });

    it('does not commit a canceled keyboard change', async () => {
      const onValueChange = vi.fn((_value, details) => details.cancel());
      const onValueCommitted = vi.fn();
      await render(
        <NumberField
          defaultValue={0}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        />,
      );
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(input, { key: 'ArrowUp' });

      expect(input).toHaveValue('0');
      expect(onValueCommitted.mock.calls.length).toBe(0);
    });

    it('does not commit a canceled clear on blur', async () => {
      const onValueChange = vi.fn((_value, details) => details.cancel());
      const onValueCommitted = vi.fn();
      await render(
        <NumberField
          defaultValue={5}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        />,
      );
      const input = screen.getByRole('textbox');

      await fireEvent.focusIn(input);
      await fireEvent.input(input, { target: { value: '' } });
      await fireEvent.focusOut(input);

      expect(onValueCommitted.mock.calls.length).toBe(0);
    });
  });

  describe('prop: disabled', () => {
    it('should disable the input', async () => {
      await render(<NumberField disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('disabled');
    });
  });

  describe('prop: readOnly', () => {
    it('should mark the input as readOnly', async () => {
      await render(<NumberField readOnly />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
    });

    it('keeps focus state in sync on a readOnly field', async () => {
      await render(
        <Field.Root>
          <NumberFieldBase.Root readOnly>
            <NumberFieldBase.Input data-testid="input" />
          </NumberFieldBase.Root>
        </Field.Root>,
      );
      const input = screen.getByTestId('input');

      await fireEvent.focusIn(input);
      expect(input).toHaveAttribute('data-focused', '');

      await fireEvent.focusOut(input);
      expect(input).not.toHaveAttribute('data-focused');
    });

    it('does not render aria-readonly on stepper buttons', async () => {
      await render(<NumberField readOnly />);

      const input = screen.getByRole('textbox');
      const increment = screen.getByRole('button', { name: 'Increase' });
      const decrement = screen.getByRole('button', { name: 'Decrease' });

      // `aria-readonly` isn't valid on the `button` role; the readonly state lives on the input,
      // and the steppers are exposed as unavailable via disabled semantics instead.
      expect(input).toHaveAttribute('readonly');
      expect(increment).not.toHaveAttribute('aria-readonly');
      expect(decrement).not.toHaveAttribute('aria-readonly');
      expect(increment).toHaveAttribute('aria-disabled', 'true');
      expect(decrement).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('prop: required', () => {
    it('should mark the input as required', async () => {
      await render(<NumberField required />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('required');
    });
  });

  describe('prop: name', () => {
    it('should set the name attribute on the hidden input', async () => {
      await render(<NumberField name="test" />);
      const hiddenInput = screen.getByText('', {
        selector: 'input[aria-hidden][type=number]',
      });
      expect(hiddenInput).toHaveAttribute('name', 'test');
    });

    it('marks the hidden input readOnly when the field is readOnly', async () => {
      await render(<NumberField name="test" readOnly />);
      const hiddenInput = screen.getByText('', {
        selector: 'input[aria-hidden][type=number]',
      });
      expect(hiddenInput).toHaveAttribute('readonly');
    });
  });

  describe('prop: min', () => {
    it('prevents the raw value from going below the `min` prop', async () => {
      const fn = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef<number | null>(5);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(v) => {
              fn(v);
              value.value = v;
            }}
            min={5}
          />
        );
      });

      await render(<App />);

      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '4' } });

      expect(input).toHaveValue('4');
      expect(fn.mock.calls[0][0]).toBe(5);
    });

    it('allows the value to go above the `min` prop', async () => {
      const fn = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef<number | null>(5);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(v) => {
              fn(v);
              value.value = v;
            }}
            min={5}
          />
        );
      });

      await render(<App />);

      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '6' } });

      expect(input).toHaveValue('6');
    });
  });

  describe('prop: max', () => {
    it('prevents the value from going above the `max` prop', async () => {
      const fn = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef<number | null>(5);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(v) => {
              fn(v);
              value.value = v;
            }}
            max={5}
          />
        );
      });

      await render(<App />);

      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '6' } });

      expect(input).toHaveValue('6');
      expect(fn.mock.calls[0][0]).toBe(5);
    });

    it('allows the value to go below the `max` prop', async () => {
      const fn = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef<number | null>(5);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(v) => {
              fn(v);
              value.value = v;
            }}
            max={5}
          />
        );
      });

      await render(<App />);

      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '4' } });

      expect(input).toHaveValue('4');
      expect(fn.mock.calls[0][0]).toBe(4);
    });
  });

  describe('prop: allowOutOfRange', () => {
    it('allows typing a negative value via keyboard when min is 0', async () => {
      await render(<NumberField min={0} allowOutOfRange />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      input.focus();

      // The minus key must not be blocked, so native underflow validation is reachable.
      // `fireEvent` resolves to `false` when the default action of the event was prevented.
      expect(await fireEvent.keyDown(input, { key: '-' })).toBe(true);
    });

    it('allows range overflow validation when true', async () => {
      await render(
        <form data-testid="form">
          <NumberFieldBase.Root name="quantity" max={5} allowOutOfRange>
            <NumberFieldBase.Group>
              <NumberFieldBase.Input />
            </NumberFieldBase.Group>
          </NumberFieldBase.Root>
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

    it('still clamps step interactions when true', async () => {
      await render(
        <form data-testid="form">
          <NumberField defaultValue={5} max={5} allowOutOfRange name="quantity" />
          <button type="submit">Submit</button>
        </form>,
      );

      const input = screen.getByRole('textbox');
      await fireEvent.click(screen.getByLabelText('Increase'));

      const hiddenInput = document.querySelector(
        'input[type="number"][name="quantity"]',
      ) as HTMLInputElement;

      expect(input).toHaveValue('5');
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput.value).toBe('5');
      expect(hiddenInput.validity.rangeOverflow).toBe(false);

      const form = screen.getByTestId<HTMLFormElement>('form');
      expect(form.checkValidity()).toBe(true);
    });

    it('clamps to range when false', async () => {
      await render(
        <form data-testid="form">
          <NumberFieldBase.Root name="quantity" max={5} allowOutOfRange={false}>
            <NumberFieldBase.Group>
              <NumberFieldBase.Input />
            </NumberFieldBase.Group>
          </NumberFieldBase.Root>
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

  describe('prop: step', () => {
    it('defaults to 1', async () => {
      await render(<NumberField defaultValue={5} />);
      const input = screen.getByRole('textbox');
      await fireEvent.click(screen.getByLabelText('Increase'));
      expect(input).toHaveValue('6');
    });

    it('should increment the value by the `step` prop', async () => {
      await render(<NumberField defaultValue={4} step={2} />);
      const input = screen.getByRole('textbox');
      await fireEvent.click(screen.getByLabelText('Increase'));
      expect(input).toHaveValue('6');
    });

    it('should snap when incrementing to the nearest multiple of the `step` prop', async () => {
      await render(<NumberField defaultValue={5} step={2} snapOnStep />);
      const input = screen.getByRole('textbox');
      await fireEvent.click(screen.getByLabelText('Increase'));
      expect(input).toHaveValue('6');
    });

    it('should decrement the value by the `step` prop', async () => {
      await render(<NumberField defaultValue={6} step={2} />);
      const input = screen.getByRole('textbox');
      await fireEvent.click(screen.getByLabelText('Decrease'));
      expect(input).toHaveValue('4');
    });

    it('should snap when decrementing to the nearest multiple of the `step` prop', async () => {
      await render(<NumberField defaultValue={5} step={2} snapOnStep />);
      const input = screen.getByRole('textbox');
      await fireEvent.click(screen.getByLabelText('Decrease'));
      expect(input).toHaveValue('4');
    });

    it('advances by a step finer than 3 fraction digits', async () => {
      const onValueChange = vi.fn();

      const Controlled = defineComponent(() => {
        const value = shallowRef<number | null>(0);
        return () => (
          <NumberField
            value={value.value}
            step={0.0001}
            onValueChange={(val: number | null) => {
              onValueChange(val);
              value.value = val;
            }}
          />
        );
      });

      const { user } = await render(<Controlled />);
      const input = screen.getByRole('textbox');
      const increase = screen.getByLabelText('Increase');

      // A step smaller than the old 3-digit default used to round back to 0, making this a no-op.
      await user.click(increase);
      expect(onValueChange.mock.lastCall?.[0]).toBe(0.0001);
      expect(input).toHaveValue('0');

      await user.click(increase);
      expect(onValueChange.mock.lastCall?.[0]).toBe(0.0002);
      expect(input).toHaveValue('0');
    });

    it('cleans binary floating point noise introduced by stepping', async () => {
      const onValueChange = vi.fn();

      await render(<NumberField defaultValue={0.7} step={0.1} onValueChange={onValueChange} />);

      await fireEvent.click(screen.getByLabelText('Increase'));

      // 0.7 + 0.1 === 0.7999999999999999 in binary floating point.
      expect(onValueChange.mock.lastCall?.[0]).toBe(0.8);
    });

    it('preserves large fractional values when stepping cleanup would be too coarse', async () => {
      const onValueChange = vi.fn();

      const Controlled = defineComponent(() => {
        const value = shallowRef<number | null>(100000000000000.1);
        return () => (
          <NumberField
            value={value.value}
            step={0.1}
            onValueChange={(val: number | null) => {
              onValueChange(val);
              value.value = val;
            }}
          />
        );
      });

      const { user } = await render(<Controlled />);

      await user.click(screen.getByLabelText('Increase'));

      expect(onValueChange.mock.lastCall?.[0]).toBe(100000000000000.1 + 0.1);
    });
  });

  describe.skipIf(isJSDOM)('prop: largeStep', () => {
    it('should increment the value by the default `largeStep` prop of 10 while holding the shift key', async () => {
      await render(<NumberField defaultValue={5} />);
      const input = screen.getByRole('textbox');
      await fireEvent.pointerDown(screen.getByLabelText('Increase'), { shiftKey: true });
      expect(input).toHaveValue('15');
    });

    it('should decrement the value by the default `largeStep` prop of 10 while holding the shift key', async () => {
      await render(<NumberField defaultValue={6} />);
      const input = screen.getByRole('textbox');
      await fireEvent.pointerDown(screen.getByLabelText('Decrease'), { shiftKey: true });
      expect(input).toHaveValue('-4');
    });

    it('should use explicit `largeStep` value if provided while holding the shift key', async () => {
      await render(<NumberField defaultValue={5} largeStep={5} />);
      const input = screen.getByRole('textbox');
      await fireEvent.pointerDown(screen.getByLabelText('Increase'), { shiftKey: true });
      expect(input).toHaveValue('10');
    });

    it('should not use the `largeStep` prop if no longer holding the shift key', async () => {
      await render(<NumberField defaultValue={5} largeStep={5} />);
      const input = screen.getByRole('textbox');
      await fireEvent.pointerDown(screen.getByLabelText('Increase'), { shiftKey: true });
      expect(input).toHaveValue('10');
      await fireEvent.keyUp(input, { shiftKey: true });
      await fireEvent.pointerDown(screen.getByLabelText('Increase'), { shiftKey: true });
      expect(input).toHaveValue('15');
    });
  });

  describe.skipIf(isJSDOM)('prop: smallStep', () => {
    it('should increment the value by the default `smallStep` prop of 0.1 while holding the alt key', async () => {
      await render(<NumberField defaultValue={5} />);
      const input = screen.getByRole('textbox');
      await fireEvent.pointerDown(screen.getByLabelText('Increase'), { altKey: true });
      expect(input).toHaveValue((5.1).toLocaleString());
    });

    it('should decrement the value by the default `smallStep` prop of 0.1 while holding the alt key', async () => {
      await render(<NumberField defaultValue={6} />);
      const input = screen.getByRole('textbox');
      await fireEvent.pointerDown(screen.getByLabelText('Decrease'), { altKey: true });
      expect(input).toHaveValue((5.9).toLocaleString());
    });

    it('should use explicit `smallStep` value if provided while holding the alt key', async () => {
      await render(<NumberField defaultValue={5} smallStep={0.5} />);
      const input = screen.getByRole('textbox');
      await fireEvent.keyDown(document.body, { altKey: true });
      await fireEvent.pointerDown(screen.getByLabelText('Increase'), { altKey: true });
      expect(input).toHaveValue((5.5).toLocaleString());
    });

    it('should not use the `smallStep` prop if no longer holding the alt key', async () => {
      await render(<NumberField defaultValue={5} smallStep={0.5} />);
      const input = screen.getByRole('textbox');
      const button = screen.getByLabelText('Increase');
      await fireEvent.pointerDown(button, { altKey: true });
      expect(input).toHaveValue((5.5).toLocaleString());
      await fireEvent.keyUp(input, { altKey: false });
      await fireEvent.pointerDown(button);
      expect(input).toHaveValue((6.5).toLocaleString());
    });
  });

  describe('prop: format', () => {
    it('reformats the visible text when the format prop changes at the same value', async () => {
      const { setProps } = await render(<NumberField value={1000} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue(new Intl.NumberFormat().format(1000));

      await setProps({ format: { style: 'currency', currency: 'USD' } });
      expect(input).toHaveValue(
        new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1000),
      );
    });

    it('should format the value using the provided options', async () => {
      await render(
        <NumberField defaultValue={1000} format={{ style: 'currency', currency: 'USD' }} />,
      );
      const input = screen.getByRole('textbox');
      const expectedValue = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
      }).format(1000);
      expect(input).toHaveValue(expectedValue);
    });

    it('reflects controlled value changes in the textbox', async () => {
      const App = defineComponent(() => {
        const val = shallowRef<number | null>(1);
        return () => (
          <div>
            <NumberField value={val.value} onValueChange={(next) => (val.value = next)} />
            <button onClick={() => (val.value = 1234)}>set</button>
          </div>
        );
      });

      const { user } = await render(<App />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveValue('1');

      await user.click(screen.getByText('set'));
      expect(input).toHaveValue((1234).toLocaleString());
    });
  });

  describe('prop: allowWheelScrub', () => {
    it('does not scrub on wheel when disabled', async () => {
      const onValueChange = vi.fn();
      await render(
        <NumberField defaultValue={5} allowWheelScrub disabled onValueChange={onValueChange} />,
      );
      await fireEvent.wheel(screen.getByRole('textbox'), { deltaY: 1 });
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not scrub on wheel when readOnly', async () => {
      const onValueChange = vi.fn();
      await render(
        <NumberField defaultValue={5} allowWheelScrub readOnly onValueChange={onValueChange} />,
      );
      const input = screen.getByRole('textbox');
      // Focus the input so the wheel handler's focus guard doesn't mask the readOnly guard.
      input.focus();
      await flushMicrotasks();

      await fireEvent.wheel(input, { deltaY: 1 });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(input).toHaveValue('5');
    });

    it('should allow the user to scrub the input value with the mouse wheel', async () => {
      await render(<NumberField defaultValue={5} allowWheelScrub />);
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();
      await fireEvent.wheel(input, { deltaY: 1 });
      expect(input).toHaveValue('4');
      await fireEvent.wheel(input, { deltaY: -1 });
      expect(input).toHaveValue('5');
    });

    it('should not allow the user to scrub the input value with the mouse wheel if `allowWheelScrub` is `false`', async () => {
      await render(<NumberField defaultValue={5} allowWheelScrub={false} />);
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();
      await fireEvent.wheel(input, { deltaY: 1 });
      expect(input).toHaveValue('5');
      await fireEvent.wheel(input, { deltaY: -5 });
      expect(input).toHaveValue('5');
    });

    it('does not scrub on wheel while pinch-zooming (ctrlKey)', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField defaultValue={5} allowWheelScrub onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      await fireEvent.wheel(input, { deltaY: 1, ctrlKey: true });
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not scrub on wheel when the input is not focused', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField defaultValue={5} allowWheelScrub onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      await fireEvent.wheel(input, { deltaY: 1 });
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not scrub on a horizontal wheel event, and lets it scroll the page', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await render(
        <NumberField
          defaultValue={5}
          allowWheelScrub
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        />,
      );
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      // `fireEvent` returns false when the event was canceled with `preventDefault`.
      expect(await fireEvent.wheel(input, { deltaY: 0, deltaX: 100 })).toBe(true);
      expect(await fireEvent.wheel(input, { deltaY: 0, deltaX: -100 })).toBe(true);
      // A precision touchpad emits sub-pixel noise on the cross axis during a sideways swipe.
      expect(await fireEvent.wheel(input, { deltaY: -0.5, deltaX: 100 })).toBe(true);
      expect(await fireEvent.wheel(input, { deltaY: 0.5, deltaX: -100 })).toBe(true);
      // An event with no movement at all.
      expect(await fireEvent.wheel(input, { deltaY: 0, deltaX: 0 })).toBe(true);

      expect(input).toHaveValue('5');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueCommitted).not.toHaveBeenCalled();
    });

    it('scrubs on a vertical wheel event that carries horizontal noise', async () => {
      await render(<NumberField defaultValue={5} allowWheelScrub />);
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      // `fireEvent` returns false when the event was canceled, which is what stops the page
      // from scrolling out from under the user while the value scrubs.
      expect(await fireEvent.wheel(input, { deltaY: 1, deltaX: -0.5 })).toBe(false);
      expect(input).toHaveValue('4');

      expect(await fireEvent.wheel(input, { deltaY: -1, deltaX: 0.5 })).toBe(false);
      expect(input).toHaveValue('5');

      expect(await fireEvent.wheel(input, { deltaY: 1 })).toBe(false);
      expect(input).toHaveValue('4');
    });

    it('uses largeStep when shift is held and the browser swaps the wheel axis', async () => {
      await render(<NumberField defaultValue={0} largeStep={10} allowWheelScrub />);
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      // Chromium delivers shift + wheel as a horizontal event, so the horizontal delta carries
      // the intended direction: positive is "down", which steps the value down.
      expect(await fireEvent.wheel(input, { deltaY: 0, deltaX: -100, shiftKey: true })).toBe(false);
      expect(input).toHaveValue('10');

      expect(await fireEvent.wheel(input, { deltaY: 0, deltaX: 100, shiftKey: true })).toBe(false);
      expect(input).toHaveValue('0');

      // Cross-axis noise must not flip the direction of the same physical gesture, so the noise
      // here opposes the horizontal delta: the dominant axis has to win.
      expect(await fireEvent.wheel(input, { deltaY: 0.5, deltaX: -100, shiftKey: true })).toBe(
        false,
      );
      expect(input).toHaveValue('10');

      expect(await fireEvent.wheel(input, { deltaY: -0.5, deltaX: 100, shiftKey: true })).toBe(
        false,
      );
      expect(input).toHaveValue('0');
    });

    it('uses largeStep when shift is held during wheel', async () => {
      const onValueChange = vi.fn();
      await render(
        <NumberField
          defaultValue={0}
          largeStep={10}
          allowWheelScrub
          onValueChange={onValueChange}
        />,
      );
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      await fireEvent.wheel(input, { deltaY: -1, shiftKey: true });
      expect(onValueChange.mock.lastCall?.[0]).toBe(10);
    });

    it('calls onValueChange and onValueCommitted on wheel', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await render(
        <NumberField
          defaultValue={5}
          allowWheelScrub
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        />,
      );
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      await fireEvent.wheel(input, { deltaY: 1 });
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe(4);
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(4);
      expect(onValueCommitted.mock.lastCall?.[1].reason).toBe(REASONS.wheel);

      await fireEvent.wheel(input, { deltaY: -1 });
      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.lastCall?.[0]).toBe(5);
      expect(onValueCommitted.mock.calls.length).toBe(2);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(5);

      // Blur doesn't commit again; the wheel changes were already committed.
      await fireEvent.focusOut(input);
      expect(onValueCommitted.mock.calls.length).toBe(2);
    });

    it('does not commit when a wheel step is a no-op at the boundary', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await render(
        <NumberField
          defaultValue={5}
          max={5}
          allowWheelScrub
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        />,
      );
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      await fireEvent.wheel(input, { deltaY: -1 });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueCommitted).not.toHaveBeenCalled();
      expect(input).toHaveValue('5');
    });

    it('syncs the visible input value when using the mouse wheel after pasting', async () => {
      const onValueChange = vi.fn();

      await render(<NumberField defaultValue={10} allowWheelScrub onValueChange={onValueChange} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      input.focus();
      await flushMicrotasks();

      // Select the existing value so the paste replaces it rather than inserting at the caret.
      input.select();
      await pasteText(input, '20');

      expect(input).toHaveValue('20');
      expect(onValueChange.mock.lastCall?.[0]).toBe(20);

      await fireEvent.wheel(input, { deltaY: -1 });

      expect(onValueChange.mock.lastCall?.[0]).toBe(21);
      expect(input).toHaveValue('21');
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
            <NumberFieldBase.Root defaultValue={undefined}>
              <NumberFieldBase.Input />
            </NumberFieldBase.Root>
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
            <NumberFieldBase.Root defaultValue={54.5} format={format} locale="de-DE">
              <NumberFieldBase.Input />
            </NumberFieldBase.Root>
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
          <NumberFieldBase.Root name="test" form="external-form" defaultValue={54.5}>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
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
            <NumberFieldBase.Root name="quantity" form="external-form" required>
              <NumberFieldBase.Input />
            </NumberFieldBase.Root>
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
                <NumberFieldBase.Root
                  form={props.form}
                  ref={(instance) => {
                    root = instance as { inputElement: HTMLInputElement | null } | null;
                  }}
                >
                  <NumberFieldBase.Input />
                </NumberFieldBase.Root>
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

    it('triggers native HTML validation on submit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="test" data-testid="field">
            <NumberField required />
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const submit = screen.getByText('Submit');

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(submit);

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });

    it('focuses the input when the field receives an error from Form', async () => {
      const App = defineComponent(() => {
        const errors = shallowRef<Record<string, string>>({});
        return () => (
          <Form
            errors={errors.value}
            onSubmit={(event: SubmitEvent) => {
              event.preventDefault();
              errors.value = { quantity: 'server error' };
            }}
          >
            <Field.Root name="quantity" data-testid="field">
              <NumberField defaultValue={1} />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      const { user } = await render(<App />);
      expect(screen.queryByTestId('error')).toBe(null);
      const submit = screen.getByText('Submit');
      await user.click(submit);

      const input = screen.getByRole('textbox');
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('server error');
    });

    it('clears external errors on change', async () => {
      await render(
        <Form
          errors={{
            test: 'test',
          }}
        >
          <Field.Root name="test" data-testid="field">
            <NumberField defaultValue={1} />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('test');

      await fireEvent.input(input, { target: { value: '5' } });

      expect(input).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('revalidates immediately after form submission errors using increment button', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="quantity">
            <NumberField required />
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit" data-testid="submit">
            Submit
          </button>
        </Form>,
      );

      const submit = screen.getByTestId('submit');
      await user.click(submit);

      expect(screen.getByTestId('error')).toHaveTextContent('required');
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      const incrementButton = screen.getByLabelText('Increase');
      await user.click(incrementButton);

      expect(screen.queryByTestId('error')).toBe(null);
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('should handle browser autofill', async () => {
      const onValueChange = vi.fn();

      await render(
        <Field.Root name="quantity">
          <NumberFieldBase.Root onValueChange={onValueChange}>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
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
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
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
              <NumberFieldBase.Root
                defaultValue={1}
                readOnly={lockState === 'readOnly'}
                disabled={lockState === 'disabled'}
                onValueChange={onValueChange}
              >
                <NumberFieldBase.Input />
              </NumberFieldBase.Root>
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
          <NumberFieldBase.Root
            name="quantity"
            defaultValue={1}
            readOnly={lockState === 'readOnly'}
            disabled={lockState === 'disabled'}
            onValueChange={onValueChange}
          >
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>,
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
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
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
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
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
            <NumberFieldBase.Root>
              <NumberFieldBase.Input data-testid="input" />
            </NumberFieldBase.Root>
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
            <NumberFieldBase.Root defaultValue={1}>
              <NumberFieldBase.Input data-testid="input" />
            </NumberFieldBase.Root>
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
          <NumberFieldBase.Root>
            <NumberFieldBase.Input data-testid="input" />
          </NumberFieldBase.Root>
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
          <NumberFieldBase.Root>
            <NumberFieldBase.Input data-testid="input" />
          </NumberFieldBase.Root>
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
              <NumberFieldBase.Root disabled={firstDisabled}>
                <NumberFieldBase.Input data-testid="first" />
              </NumberFieldBase.Root>
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
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
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
              <NumberFieldBase.Root required data-testid="root">
                <NumberFieldBase.Input data-testid="input" />
              </NumberFieldBase.Root>
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
            <NumberFieldBase.Root>
              <NumberFieldBase.Input data-testid="input" />
            </NumberFieldBase.Root>
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
                <NumberFieldBase.Root
                  value={value.value}
                  onValueChange={(next) => {
                    value.value = next;
                  }}
                >
                  <NumberFieldBase.Input data-testid="input" />
                </NumberFieldBase.Root>
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
            <NumberFieldBase.Root required>
              <NumberFieldBase.Input data-testid="input" />
            </NumberFieldBase.Root>
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
          <NumberFieldBase.Root name="quantity" defaultValue={0} min={0} step={0.1}>
            <NumberFieldBase.Input data-testid="input" />
          </NumberFieldBase.Root>
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
            <NumberFieldBase.Root defaultValue={0} min={0} step={0.1}>
              <NumberFieldBase.Input data-testid="input" />
            </NumberFieldBase.Root>
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
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(input).toHaveAttribute('disabled', '');
    });

    it('does not disable the input when disabled=false', async () => {
      await render(
        <Field.Root disabled={false}>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
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
            <NumberFieldBase.Root defaultValue={undefined}>
              <NumberFieldBase.Input />
            </NumberFieldBase.Root>
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
            <NumberFieldBase.Root max={10}>
              <NumberFieldBase.Input />
            </NumberFieldBase.Root>
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
              <NumberFieldBase.Root
                value={value.value}
                onValueChange={(next) => {
                  value.value = next;
                }}
                max={5}
              >
                <NumberFieldBase.Input />
              </NumberFieldBase.Root>
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
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
          <Field.Label data-testid="label" />
        </Field.Root>,
      );

      expect(screen.getByTestId('label')).toHaveAttribute('for', screen.getByRole('textbox').id);
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input aria-describedby="external-description" />
          </NumberFieldBase.Root>
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      expect(screen.getByRole('textbox')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  describe('prop: inputMode', () => {
    it('should set the inputMode to numeric', async () => {
      await render(<NumberField />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('inputmode', 'numeric');
    });
  });

  describe('hidden input', () => {
    it('forwards focus to the visible input', async () => {
      await render(<NumberField defaultValue={5} />);

      getHiddenInput().focus();
      await flushMicrotasks();

      expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('places the caret at the end of the visible input when forwarding focus', async () => {
      await render(<NumberField defaultValue={100} />);

      const input = screen.getByRole<HTMLInputElement>('textbox');
      input.setSelectionRange(0, 0);

      getHiddenInput().focus();
      await flushMicrotasks();

      expect(input).toHaveFocus();
      expect(input.selectionStart).toBe(input.value.length);
      expect(input.selectionEnd).toBe(input.value.length);
    });

    it('keeps a selection the consumer sets in onFocus when forwarding focus', async () => {
      await render(
        <NumberFieldBase.Root defaultValue={100}>
          <NumberFieldBase.Input
            onFocusin={(event) => (event.currentTarget as HTMLInputElement).select()}
          />
        </NumberFieldBase.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      getHiddenInput().focus();
      await flushMicrotasks();

      expect(input).toHaveFocus();
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });

    it('clears the value when autofill empties the hidden input', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField defaultValue={5} onValueChange={onValueChange} />);

      await fireEvent.change(getHiddenInput(), { target: { value: '' } });

      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(onValueChange.mock.lastCall?.[0]).toBe(null);
    });

    it('applies an autofilled value to the visible input', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField onValueChange={onValueChange} />);

      await fireEvent.change(getHiddenInput(), { target: { value: '7' } });

      expect(screen.getByRole('textbox')).toHaveValue('7');
      expect(onValueChange.mock.lastCall?.[0]).toBe(7);
    });

    it('validates the autofilled value even when the change is canceled', async () => {
      const validate = vi.fn((_value: unknown) => null);

      await render(
        <Field.Root validate={validate} validationMode="onChange">
          <NumberField onValueChange={(_value, details) => details.cancel()} />
        </Field.Root>,
      );

      await fireEvent.change(getHiddenInput(), { target: { value: '7' } });

      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(validate.mock.lastCall?.[0]).toBe(7);
    });
  });

  describe('integration: exotic inputs and IME', () => {
    it('accepts Persian digit keyboard input', async () => {
      const onValueChange = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<number | null>(null);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(v: number | null) => {
              onValueChange(v);
              value.value = v;
            }}
          />
        );
      });
      const { user } = await render(<App />);
      const input = screen.getByRole('textbox');

      await user.type(input, '۱۲۳');

      expect(onValueChange.mock.calls.at(-1)?.[0]).toBe(123);
    });

    it.each([
      ['Persian', '۱۲۳', 123],
      ['Arabic-Indic', '١٢٣', 123],
      ['fullwidth', '１２３', 123],
      ['Han', '一二三', 123],
    ] as const)('pastes %s numerals through the input contract', async (_label, text, value) => {
      const onValueChange = vi.fn();
      await render(<NumberField defaultValue={0} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      await flushMicrotasks();
      input.select();
      await pasteText(input, text);

      expect(input).toHaveValue(text);
      expect(onValueChange.mock.lastCall?.[0]).toBe(value);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe(REASONS.inputPaste);
    });

    it('rejects invalid pasted characters without changing the value contract', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField defaultValue={12} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      await flushMicrotasks();
      input.select();
      await pasteText(input, 'abc');

      expect(input).toHaveValue('12');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('parses Persian digits and separators via change events', async () => {
      const onValueChange = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<number | null>(null);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(v: number | null) => {
              onValueChange(v);
              value.value = v;
            }}
          />
        );
      });
      await render(<App />);

      const input = screen.getByRole('textbox');
      // ۱۲٫۳۴ => 12.34
      await fireEvent.input(input, { target: { value: '۱۲٫۳۴' } });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(12.34);
    });

    it('parses Persian digits with Arabic group/decimal separators', async () => {
      const onValueChange = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<number | null>(null);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(v: number | null) => {
              onValueChange(v);
              value.value = v;
            }}
          />
        );
      });
      await render(<App />);

      const input = screen.getByRole('textbox');
      // ۱۲٬۳۴۵٫۶۷ => 12345.67
      await fireEvent.input(input, { target: { value: '۱۲٬۳۴۵٫۶۷' } });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(12345.67);
    });

    it('parses fullwidth digits and punctuation', async () => {
      const onValueChange = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<number | null>(null);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(v: number | null) => {
              onValueChange(v);
              value.value = v;
            }}
          />
        );
      });

      await render(<App />);

      const input = screen.getByRole('textbox');

      await fireEvent.input(input, { target: { value: '１，２３４．５６' } });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(1234.56);
    });

    it('parses percent and permille signs in exotic forms when formatted as percent', async () => {
      const onValueChange = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<number | null>(null);
        return () => (
          <NumberField
            value={value.value}
            format={{ style: 'percent' }}
            onValueChange={(v: number | null) => {
              onValueChange(v);
              value.value = v;
            }}
          />
        );
      });

      await render(<App />);

      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '١٢٪' } });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(0.12);

      // reset by typing again
      await fireEvent.input(input, { target: { value: '12؉' } });
      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[1][0]).toBe(0.012);
    });

    it('ignores percent and permille symbols when not formatted as percent', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField onValueChange={onValueChange} />);

      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '12' } });
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(12);

      await fireEvent.input(input, { target: { value: '12%' } });
      await fireEvent.input(input, { target: { value: '12‰' } });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(input).toHaveValue('12');
    });

    it('parses trailing unicode minus', async () => {
      const onValueChange = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<number | null>(null);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(v: number | null) => {
              onValueChange(v);
              value.value = v;
            }}
          />
        );
      });

      await render(<App />);

      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '1234−' } });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(-1234);
    });

    it('treats parentheses negatives as invalid input', async () => {
      const onValueChange = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<number | null>(null);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(v: number | null) => {
              onValueChange(v);
              value.value = v;
            }}
          />
        );
      });

      await render(<App />);

      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '(1,234.5)' } });

      expect(onValueChange.mock.calls.length).toBe(0);
      expect(input).toHaveValue('');
    });

    it('collapses extra dots from mixed-locale inputs', async () => {
      const onValueChange = vi.fn();
      const App = defineComponent(() => {
        const value = shallowRef<number | null>(null);
        return () => (
          <NumberField
            value={value.value}
            onValueChange={(v: number | null) => {
              onValueChange(v);
              value.value = v;
            }}
          />
        );
      });

      await render(<App />);

      const input = screen.getByRole('textbox');
      await fireEvent.input(input, { target: { value: '1.234.567.89' } });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(1234567.89);
    });

    it('allows composition key events (IME) without preventing default', async () => {
      await render(<NumberField />);

      const input = screen.getByRole('textbox');

      input.focus();
      await flushMicrotasks();

      // keyCode 229 indicates a composition key event. The input reads `which`, and only Chromium
      // derives it from `keyCode` for a constructed event.
      // Use a single-character key that would otherwise be blocked, so only the composition
      // bypass can let it through.
      expect(await fireEvent.keyDown(input, { key: 'a', keyCode: 229, which: 229 })).toBe(true);
    });
  });

  describe.skipIf(isJSDOM)('pasting', () => {
    it('should allow pasting a valid number', async () => {
      await render(<NumberField />);
      const input = screen.getByRole('textbox');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '123');

      await fireEvent.paste(input, { clipboardData: dataTransfer });
      await fireEvent.input(input, { target: { value: '123' } });
      expect(input).toHaveValue('123');
    });

    it('should not allow pasting an invalid number', async () => {
      await render(<NumberField />);
      const input = screen.getByRole('textbox');

      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', 'abc');

      await fireEvent.paste(input, { clipboardData: dataTransfer });
      await fireEvent.input(input, { target: { value: 'abc' } });
      expect(input).toHaveValue('');
      await fireEvent.focusOut(input);
      expect(input).toHaveValue('');
    });
  });

  describe('pasting at the caret', () => {
    it('ignores a paste that does not parse to a number', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField defaultValue={1} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      await flushMicrotasks();
      input.select();
      await pasteText(input, 'abc');

      expect(input).toHaveValue('1');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not paste into a readOnly field', async () => {
      await render(<NumberField defaultValue={1} readOnly />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      await flushMicrotasks();
      input.select();
      await pasteText(input, '9');

      expect(input).toHaveValue('1');
    });

    it('inserts pasted text at the caret instead of replacing the whole value', async () => {
      const onValueChange = vi.fn();
      await render(<NumberField defaultValue={123} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      await flushMicrotasks();
      input.setSelectionRange(3, 3);
      await pasteText(input, '5');

      expect(input).toHaveValue('1235');
      expect(onValueChange.mock.lastCall?.[0]).toBe(1235);
    });

    it('replaces the selected range when pasting over a selection', async () => {
      await render(<NumberField defaultValue={123} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      await flushMicrotasks();
      input.setSelectionRange(1, 2);
      await pasteText(input, '9');

      expect(input).toHaveValue('193');
    });

    it('keeps the caret just after the pasted text', async () => {
      await render(<NumberField defaultValue={123} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      await flushMicrotasks();
      input.setSelectionRange(1, 2);
      await pasteText(input, '9');

      expect(input).toHaveValue('193');
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
    });
  });

  it('should allow navigation keys and not prevent their default behavior', async () => {
    await render(<NumberField />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();
    await fireEvent.input(input, { target: { value: '123' } });

    const navigateKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    for (const key of navigateKeys) {
      // `fireEvent` resolves to `false` when the default action of the event was prevented.
      expect(await fireEvent.keyDown(input, { key })).toBe(true);
    }
  });

  it('does not prevent native caret movement for Home/End without min/max', async () => {
    await render(<NumberField defaultValue={5} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    for (const key of ['Home', 'End']) {
      // `fireEvent` resolves to `false` when the default action of the event was prevented.
      expect(await fireEvent.keyDown(input, { key })).toBe(true);
    }
    expect(input).toHaveValue('5');
  });

  it('does not swallow non-printing keys it does not handle', async () => {
    await render(<NumberField defaultValue={5} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    for (const key of ['PageUp', 'PageDown', 'Insert', 'F5']) {
      // `fireEvent` resolves to `false` when the default action of the event was prevented.
      expect(await fireEvent.keyDown(input, { key })).toBe(true);
    }
  });

  describe('prop: locale', () => {
    it('should set the locale of the input', async () => {
      await render(<NumberField defaultValue={1000.5} locale="de-DE" />);
      const input = screen.getByRole('textbox');

      // In German locale, numbers use dot as thousands separator and comma as decimal separator
      const expectedValue = new Intl.NumberFormat('de-DE').format(1000.5);
      expect(input).toHaveValue(expectedValue);
    });

    it('should use the default locale if no locale is provided', async () => {
      await render(<NumberField defaultValue={1000.5} />);
      const input = screen.getByRole('textbox');
      const expectedValue = new Intl.NumberFormat().format(1000.5);
      expect(input).toHaveValue(expectedValue);
    });

    it('should handle locales using space as the thousands separator', async () => {
      await render(<NumberField defaultValue={12345.5} locale="pl" />);

      const input = screen.getByRole('textbox');
      const expectedValue = new Intl.NumberFormat('pl').format(12345.5);
      expect(input).toHaveValue(expectedValue);

      const incrementButton = screen.getByLabelText('Increase');
      await fireEvent.click(incrementButton);

      const newExpectedValue = new Intl.NumberFormat('pl').format(12346.5);
      expect(input).toHaveValue(newExpectedValue);
    });
  });
});
