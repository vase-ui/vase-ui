import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { OTPField as OTPFieldBase } from '@vase-ui/vue/otp-field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import OTPFieldRootHydration from './OTPFieldRootHydration.test.vue';
import OTPFieldRootReplace from './OTPFieldRootReplace.test.vue';

// The root follows a reset in a timeout of 0 ms, after the listeners of the event.
// The case that calls this function uses fake timers.
async function settleReset() {
  vi.advanceTimersByTime(0);
  await flushMicrotasks();
}

function getHiddenInput(container: Element) {
  return container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
}

// A program that fills a form writes the value and sends `input`, `change` or both. No microtask
// runs between the events.
async function fillHiddenInput(
  input: HTMLInputElement,
  value: string,
  types: Array<'input' | 'change'>,
) {
  input.value = value;
  for (const type of types) {
    input.dispatchEvent(new Event(type, { bubbles: true }));
  }
  await flushMicrotasks();
}

describe('<OTPField.Root />', () => {
  const { render } = createRenderer();
  const OTP_LENGTH = 6;

  describeConformance(<OTPFieldBase.Root length={1} />, () => ({
    refInstanceof: window.HTMLDivElement,
    testRenderPropWith: 'div',
    render,
  }));

  describe('value handling', () => {
    it('emits `update:value` after `valueChange`, and not after a cancel', async () => {
      const calls: string[] = [];
      let cancel = false;
      const { container } = await render(
        <OTPFieldBase.Root
          length={OTP_LENGTH}
          onValueChange={(value, details) => {
            calls.push(`valueChange:${value}`);
            if (cancel) {
              details.cancel();
            }
          }}
          {...{ 'onUpdate:value': (value: string) => calls.push(`update:${value}`) }}
        />,
      );
      const hiddenInput = getHiddenInput(container);

      await fireEvent.input(hiddenInput, { target: { value: '1' } });

      expect(calls).toEqual(['valueChange:1', 'update:1']);

      cancel = true;
      await fireEvent.input(hiddenInput, { target: { value: '12' } });

      expect(calls).toEqual(['valueChange:1', 'update:1', 'valueChange:12']);
      expect(hiddenInput.value).toBe('1');
    });

    it('follows `v-model:value` in both directions', async () => {
      const value = shallowRef('12');
      const { container } = await render(() => (
        <OTPFieldBase.Root
          length={OTP_LENGTH}
          value={value.value}
          {...{ 'onUpdate:value': (next: string) => (value.value = next) }}
        />
      ));
      const hiddenInput = getHiddenInput(container);

      await fireEvent.input(hiddenInput, { target: { value: '123' } });

      expect(value.value).toBe('123');
      expect(hiddenInput.value).toBe('123');

      value.value = '45';
      await flushMicrotasks();

      expect(hiddenInput.value).toBe('45');
    });

    it('writes the controlled value to the hidden input when the parent keeps its value', async () => {
      const handleValueChange = vi.fn();
      const { container } = await render(
        <OTPFieldBase.Root length={OTP_LENGTH} value="12" onValueChange={handleValueChange} />,
      );
      const hiddenInput = getHiddenInput(container);

      await fireEvent.input(hiddenInput, { target: { value: '123' } });

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.calls[0][0]).toBe('123');
      expect(hiddenInput.value).toBe('12');
    });

    it.each([
      { name: 'the default value', props: { defaultValue: '12a34b56c7' } },
      { name: 'the controlled value', props: { value: '12a34b56c7' } },
    ])('applies the validation type and the length to $name', async ({ props }) => {
      const { container } = await render(<OTPFieldBase.Root length={OTP_LENGTH} {...props} />);

      expect(getHiddenInput(container).value).toBe('123456');
    });

    it('applies the normalizer after the validation type', async () => {
      const { container } = await render(
        <OTPFieldBase.Root
          length={OTP_LENGTH}
          validationType="alphanumeric"
          normalizeValue={(value) => value.toUpperCase()}
          defaultValue="a1-b2"
        />,
      );

      expect(getHiddenInput(container).value).toBe('A1B2');
    });
  });

  describe('state', () => {
    it.each([
      { name: 'an empty value', props: {}, present: [], absent: ['data-filled', 'data-complete'] },
      {
        name: 'a partial value',
        props: { defaultValue: '12' },
        present: ['data-filled'],
        absent: ['data-complete'],
      },
      {
        name: 'a complete value',
        props: { defaultValue: '123456' },
        present: ['data-filled', 'data-complete'],
        absent: [],
      },
      {
        name: 'the disabled, read-only and required',
        props: { disabled: true, readOnly: true, required: true },
        present: ['data-disabled', 'data-readonly', 'data-required'],
        absent: [],
      },
    ])('gives the group the attributes of $name', async ({ props, present, absent }) => {
      await render(<OTPFieldBase.Root length={OTP_LENGTH} {...props} />);
      const group = screen.getByRole('group');

      present.forEach((name) => expect(group).toHaveAttribute(name, ''));
      absent.forEach((name) => expect(group).not.toHaveAttribute(name));
      // The value and the length are in the state, and they have no attribute.
      expect(group).not.toHaveAttribute('data-value');
      expect(group).not.toHaveAttribute('data-length');
    });

    it('is disabled when the field is disabled', async () => {
      const { container } = await render(
        <Field.Root disabled>
          <OTPFieldBase.Root length={OTP_LENGTH} name="otp" />
        </Field.Root>,
      );

      expect(getHiddenInput(container)).toBeDisabled();
      expect(screen.getByRole('group')).toHaveAttribute('data-disabled', '');
    });

    it('gives the default slot the state', async () => {
      await render(
        <OTPFieldBase.Root
          length={OTP_LENGTH}
          defaultValue="12"
          v-slots={{
            default: ({ state }: { state: OTPFieldBase.Root.State }) => (
              <span data-testid="state">{`${state.value}:${state.complete}:${state.length}`}</span>
            ),
          }}
        />,
      );

      expect(screen.getByTestId('state').textContent).toBe('12:false:6');
    });
  });

  describe('Field', () => {
    it('names the group with `Field.Label` and describes it with `Field.Description`', async () => {
      await render(
        <Field.Root>
          <Field.Label>Verification code</Field.Label>
          <OTPFieldBase.Root length={OTP_LENGTH} />
          <Field.Description>Enter the six digits.</Field.Description>
        </Field.Root>,
      );
      const group = screen.getByRole('group');

      expect(group).toHaveAccessibleName('Verification code');
      expect(group).toHaveAccessibleDescription('Enter the six digits.');
    });

    it('puts the `aria-describedby` of the consumer before the description of the field', async () => {
      await render(
        <Field.Root>
          <OTPFieldBase.Root length={OTP_LENGTH} aria-describedby="custom" />
          <Field.Description>Enter the six digits.</Field.Description>
        </Field.Root>,
      );

      expect(screen.getByRole('group').getAttribute('aria-describedby')).toBe(
        `custom ${screen.getByText('Enter the six digits.').id}`,
      );
    });

    it('lets the `aria-labelledby` of the consumer win over the label of the field', async () => {
      await render(
        <Field.Root>
          <Field.Label>Verification code</Field.Label>
          <OTPFieldBase.Root length={OTP_LENGTH} aria-labelledby="custom" />
        </Field.Root>,
      );

      expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'custom');
    });

    it('validates the value of the root when the form submits', async () => {
      const validate = vi.fn((value: unknown) => (value === '123456' ? null : 'Wrong code'));
      await render(
        <Form data-testid="form">
          <Field.Root name="otp" validate={validate}>
            <OTPFieldBase.Root length={OTP_LENGTH} defaultValue="12" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      await fireEvent.submit(screen.getByTestId('form'));

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.calls[0][0]).toBe('12');
      expect(screen.getByTestId('error')).toHaveTextContent('Wrong code');
    });

    it('shows the error of the form for the name of the root', async () => {
      await render(
        <Form errors={{ otp: 'Server error' }}>
          <Field.Root>
            <OTPFieldBase.Root length={OTP_LENGTH} name="otp" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByTestId('error')).toHaveTextContent('Server error');
    });

    it('marks the group filled after a change in a field', async () => {
      const { container } = await render(
        <Field.Root>
          <OTPFieldBase.Root length={OTP_LENGTH} />
        </Field.Root>,
      );
      const group = screen.getByRole('group');

      expect(group).not.toHaveAttribute('data-filled');

      await fireEvent.input(getHiddenInput(container), { target: { value: '1' } });

      expect(group).toHaveAttribute('data-filled', '');
      expect(group).toHaveAttribute('data-dirty', '');
    });
  });

  describe('Form', () => {
    it.each([
      { name: 'the value of a named field', props: { name: 'otp' }, expected: [['otp', '123456']] },
      { name: 'nothing for a field with no name', props: {}, expected: [] },
      {
        name: 'nothing for a disabled field',
        props: { name: 'otp', disabled: true },
        expected: [],
      },
    ])('submits $name', async ({ props, expected }) => {
      await render(
        <form data-testid="form">
          <OTPFieldBase.Root length={OTP_LENGTH} defaultValue="123456" {...props} />
        </form>,
      );

      expect(Array.from(new FormData(screen.getByTestId<HTMLFormElement>('form')))).toEqual(
        expected,
      );
    });

    it('puts the hidden input in the form that `form` names', async () => {
      await render(
        <div>
          <form id="verification-form" data-testid="form" />
          <OTPFieldBase.Root
            length={OTP_LENGTH}
            defaultValue="123456"
            name="otp"
            form="verification-form"
          />
        </div>,
      );

      expect(Array.from(new FormData(screen.getByTestId<HTMLFormElement>('form')))).toEqual([
        ['otp', '123456'],
      ]);
    });

    it.each([
      {
        name: 'an empty required field',
        props: { required: true },
        valid: false,
        flag: 'valueMissing',
      },
      {
        name: 'an incomplete field',
        props: { defaultValue: '123' },
        valid: false,
        flag: 'patternMismatch',
      },
      {
        name: 'a complete required field',
        props: { required: true, defaultValue: '123456' },
        valid: true,
        flag: 'valid',
      },
      {
        name: 'an incomplete field with no validation',
        props: { defaultValue: '123', validationType: 'none' as const },
        valid: true,
        flag: 'valid',
      },
      { name: 'an empty optional field', props: {}, valid: true, flag: 'valid' },
    ])('gives the validity of $name', async ({ props, valid, flag }) => {
      const { container } = await render(
        <form data-testid="form">
          <OTPFieldBase.Root length={OTP_LENGTH} name="otp" {...props} />
        </form>,
      );
      const hiddenInput = getHiddenInput(container);

      expect(hiddenInput.validity[flag as keyof ValidityState]).toBe(true);
      expect(screen.getByTestId<HTMLFormElement>('form').checkValidity()).toBe(valid);
    });

    it('does not submit a required field that is empty, and submits it when it is complete', async () => {
      const handleSubmit = vi.fn((event: Event) => event.preventDefault());
      const { container } = await render(
        <form data-testid="form" onSubmit={handleSubmit}>
          <OTPFieldBase.Root length={OTP_LENGTH} name="otp" required />
        </form>,
      );
      const form = screen.getByTestId<HTMLFormElement>('form');

      form.requestSubmit();

      expect(handleSubmit).not.toHaveBeenCalled();

      await fireEvent.input(getHiddenInput(container), { target: { value: '123456' } });
      form.requestSubmit();

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    describe('BUG-6206: a native reset', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('puts an uncontrolled field back to its default value', async () => {
        const handleValueChange = vi.fn();
        const { container } = await render(
          <form data-testid="form">
            <OTPFieldBase.Root
              length={OTP_LENGTH}
              name="otp"
              defaultValue="12"
              onValueChange={handleValueChange}
            />
          </form>,
        );
        const form = screen.getByTestId<HTMLFormElement>('form');
        const hiddenInput = getHiddenInput(container);
        await fireEvent.input(hiddenInput, { target: { value: '123456' } });
        handleValueChange.mockClear();

        form.reset();

        // Vue keeps the `value` attribute of the input equal to its value, so the reset of the
        // browser changes nothing. The root changes the value after the reset.
        expect(hiddenInput.value).toBe('123456');

        await settleReset();

        expect(handleValueChange).toHaveBeenCalledTimes(1);
        expect(handleValueChange.mock.calls[0][0]).toBe('12');
        expect(handleValueChange.mock.calls[0][1].reason).toBe(REASONS.none);
        expect(handleValueChange.mock.calls[0][1].event.type).toBe('reset');
        expect(hiddenInput.value).toBe('12');
        expect(new FormData(form).get('otp')).toBe('12');
        expect(screen.getByRole('group')).toHaveAttribute('data-filled', '');
      });

      it('puts a field with no default value back to the empty value', async () => {
        const { container } = await render(
          <form data-testid="form">
            <OTPFieldBase.Root length={OTP_LENGTH} name="otp" />
          </form>,
        );
        await fireEvent.input(getHiddenInput(container), { target: { value: '123' } });

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(getHiddenInput(container).value).toBe('');
        expect(screen.getByRole('group')).not.toHaveAttribute('data-filled');
      });

      it('does not change a controlled field, and keeps its value in the hidden input', async () => {
        const handleValueChange = vi.fn();
        const { container } = await render(
          <form data-testid="form">
            <OTPFieldBase.Root
              length={OTP_LENGTH}
              name="otp"
              value="1234"
              onValueChange={handleValueChange}
            />
          </form>,
        );

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(handleValueChange).not.toHaveBeenCalled();
        expect(getHiddenInput(container).value).toBe('1234');
      });

      it('does nothing when a listener prevents the reset', async () => {
        const handleValueChange = vi.fn();
        const { container } = await render(
          <form data-testid="form" onReset={(event: Event) => event.preventDefault()}>
            <OTPFieldBase.Root
              length={OTP_LENGTH}
              name="otp"
              defaultValue="12"
              onValueChange={handleValueChange}
            />
          </form>,
        );
        await fireEvent.input(getHiddenInput(container), { target: { value: '123' } });
        handleValueChange.mockClear();

        screen.getByTestId<HTMLFormElement>('form').reset();
        await settleReset();

        expect(handleValueChange).not.toHaveBeenCalled();
        expect(getHiddenInput(container).value).toBe('123');
      });

      describe('VUE-21: a native reset clears the error of the field', () => {
        it('VUE-21: removes the error of an uncontrolled field and starts no validation', async () => {
          const validate = vi.fn((value: unknown) => (value === '123456' ? null : 'Wrong code'));
          const { container } = await render(
            <Form data-testid="form">
              <Field.Root name="otp" validationMode="onChange" validate={validate}>
                <OTPFieldBase.Root length={OTP_LENGTH} />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>,
          );
          const hiddenInput = getHiddenInput(container);
          await fireEvent.input(hiddenInput, { target: { value: '1' } });
          await flushMicrotasks();

          expect(screen.getByTestId('error')).toHaveTextContent('Wrong code');
          expect(hiddenInput).toHaveAttribute('aria-invalid', 'true');
          validate.mockClear();

          screen.getByTestId<HTMLFormElement>('form').reset();
          await settleReset();

          expect(hiddenInput.value).toBe('');
          expect(screen.queryByTestId('error')).toBe(null);
          expect(hiddenInput).not.toHaveAttribute('aria-invalid');
          expect(validate).not.toHaveBeenCalled();
        });

        it('VUE-21: removes the error of the form from a controlled field that keeps its value', async () => {
          const { container } = await render(
            <Form data-testid="form" errors={{ otp: 'Server error' }}>
              <Field.Root name="otp">
                <OTPFieldBase.Root length={OTP_LENGTH} value="1234" />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>,
          );

          expect(screen.getByTestId('error')).toHaveTextContent('Server error');

          screen.getByTestId<HTMLFormElement>('form').reset();
          await settleReset();

          expect(getHiddenInput(container).value).toBe('1234');
          expect(screen.queryByTestId('error')).toBe(null);
        });
      });
    });

    describe('autofill', () => {
      it.each([
        { name: 'an `input` event', types: ['input'] as Array<'input' | 'change'> },
        { name: 'a `change` event', types: ['change'] as Array<'input' | 'change'> },
        { name: 'an `input` and a `change` event', types: ['input', 'change'] as const },
      ])('takes a code that $name reports one time', async ({ types }) => {
        const handleValueChange = vi.fn();
        const handleValueInvalid = vi.fn();
        const handleValueComplete = vi.fn();
        const { container } = await render(
          <OTPFieldBase.Root
            length={OTP_LENGTH}
            name="otp"
            onValueChange={handleValueChange}
            onValueInvalid={handleValueInvalid}
            onValueComplete={handleValueComplete}
          />,
        );
        const hiddenInput = getHiddenInput(container);

        await fillHiddenInput(hiddenInput, '12a34b56', [...types]);

        expect(hiddenInput.value).toBe('123456');
        expect(handleValueChange).toHaveBeenCalledTimes(1);
        expect(handleValueChange.mock.calls[0][0]).toBe('123456');
        expect(handleValueChange.mock.calls[0][1].reason).toBe(REASONS.inputChange);
        expect(handleValueInvalid).toHaveBeenCalledTimes(1);
        expect(handleValueInvalid.mock.calls[0][0]).toBe('12a34b56');
        expect(handleValueComplete).toHaveBeenCalledTimes(1);
        expect(handleValueComplete.mock.calls[0][0]).toBe('123456');
        expect(handleValueComplete.mock.calls[0][1].reason).toBe(REASONS.inputChange);
      });

      it('takes a `change` event for the value that the input had before a change of the parent', async () => {
        const value = shallowRef('');
        const handleValueChange = vi.fn();
        const { container } = await render(() => (
          <OTPFieldBase.Root
            length={OTP_LENGTH}
            name="otp"
            value={value.value}
            onValueChange={handleValueChange}
          />
        ));
        const hiddenInput = getHiddenInput(container);

        value.value = '12';
        await flushMicrotasks();

        expect(hiddenInput.value).toBe('12');

        await fillHiddenInput(hiddenInput, '', ['change']);

        expect(handleValueChange).toHaveBeenCalledTimes(1);
        expect(handleValueChange.mock.calls[0][0]).toBe('');
      });

      it('composes the validation type and the normalizer', async () => {
        const handleValueChange = vi.fn();
        const { container } = await render(
          <OTPFieldBase.Root
            length={OTP_LENGTH}
            name="otp"
            validationType="alphanumeric"
            normalizeValue={(value) => value.toUpperCase()}
            onValueChange={handleValueChange}
          />,
        );
        const hiddenInput = getHiddenInput(container);

        await fillHiddenInput(hiddenInput, 'ab-12 cd!', ['input']);

        expect(hiddenInput.value).toBe('AB12CD');
        expect(handleValueChange).toHaveBeenCalledTimes(1);
        expect(handleValueChange.mock.calls[0][0]).toBe('AB12CD');
      });

      it.each([
        { name: 'read-only', props: { readOnly: true } },
        { name: 'disabled', props: { disabled: true } },
      ])('ignores a code that autofill writes into a $name field', async ({ props }) => {
        const handleValueChange = vi.fn();
        const handleValueInvalid = vi.fn();
        const { container } = await render(
          <OTPFieldBase.Root
            length={OTP_LENGTH}
            name="otp"
            defaultValue="12"
            onValueChange={handleValueChange}
            onValueInvalid={handleValueInvalid}
            {...props}
          />,
        );
        const hiddenInput = getHiddenInput(container);

        await fillHiddenInput(hiddenInput, '12a34b56', ['input']);

        expect(hiddenInput.value).toBe('12');
        expect(handleValueChange).not.toHaveBeenCalled();
        expect(handleValueInvalid).not.toHaveBeenCalled();
      });

      it('writes the value to the hidden input again on `pageshow`', async () => {
        const { container } = await render(
          <OTPFieldBase.Root length={OTP_LENGTH} name="otp" defaultValue="12" />,
        );
        const hiddenInput = getHiddenInput(container);
        // A browser restores the form state of a page with no event on the input.
        hiddenInput.value = '97';

        window.dispatchEvent(new Event('pageshow'));

        expect(hiddenInput.value).toBe('12');
      });
    });

    describe('prop: autoSubmit', () => {
      it('does not submit the owning form when the value becomes complete by default', async () => {
        const handleSubmit = vi.fn((event: Event) => event.preventDefault());
        const { container } = await render(
          <form onSubmit={handleSubmit}>
            <OTPFieldBase.Root length={OTP_LENGTH} name="otp" />
          </form>,
        );

        await fireEvent.input(getHiddenInput(container), { target: { value: '123456' } });

        expect(handleSubmit).not.toHaveBeenCalled();
      });

      it('submits the owning form after `valueComplete`, when the value becomes complete', async () => {
        const calls: string[] = [];
        const { container } = await render(
          <form
            onSubmit={(event: Event) => {
              event.preventDefault();
              calls.push('submit');
            }}
          >
            <OTPFieldBase.Root
              length={OTP_LENGTH}
              name="otp"
              autoSubmit
              onValueComplete={(value) => calls.push(`complete:${value}`)}
            />
          </form>,
        );
        const hiddenInput = getHiddenInput(container);

        await fireEvent.input(hiddenInput, { target: { value: '12345' } });

        expect(calls).toEqual([]);

        await fireEvent.input(hiddenInput, { target: { value: '123456' } });

        expect(calls).toEqual(['complete:123456', 'submit']);
      });

      it('submits the form that `form` names', async () => {
        const handleSubmit = vi.fn((event: Event) => event.preventDefault());
        const { container } = await render(
          <div>
            <form id="verification-form" onSubmit={handleSubmit} />
            <OTPFieldBase.Root length={OTP_LENGTH} form="verification-form" autoSubmit />
          </div>,
        );

        await fireEvent.input(getHiddenInput(container), { target: { value: '123456' } });

        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('does not submit an ancestor form when `form` names an element that is not a form', async () => {
        const handleSubmit = vi.fn((event: Event) => event.preventDefault());
        const { container } = await render(
          <form onSubmit={handleSubmit}>
            <div id="not-a-form" />
            <OTPFieldBase.Root length={OTP_LENGTH} form="not-a-form" autoSubmit />
          </form>,
        );

        await fireEvent.input(getHiddenInput(container), { target: { value: '123456' } });

        expect(handleSubmit).not.toHaveBeenCalled();
      });
    });
  });

  describe('hidden input', () => {
    it('renders no hidden input for a length that is not a positive integer', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const { container } = await render(<OTPFieldBase.Root length={0} />);

        expect(container.querySelector('input')).toBe(null);
      } finally {
        warnSpy.mockRestore();
      }
    });

    describe('hidden input size', () => {
      it('keeps the 1px size in the next render of the root', async () => {
        const { container } = await render(<OTPFieldBase.Root length={OTP_LENGTH} required />);
        const input = getHiddenInput(container);
        input.reportValidity();
        await flushMicrotasks();

        await fireEvent.input(input, { target: { value: '1' } });

        const { width, height } = input.getBoundingClientRect();
        expect({ width, height }).toEqual({ width: 1, height: 1 });
      });
    });

    describe('replacing the root', () => {
      it('uses a root that mounts before the old root unmounts as the input of the field', async () => {
        const swapped = shallowRef(false);
        const { container } = await render(() => <OTPFieldRootReplace swapped={swapped.value} />);

        swapped.value = true;
        await flushMicrotasks();

        expect(container.querySelectorAll('input[aria-hidden]')).toHaveLength(1);
        const input = getHiddenInput(container);
        await fireEvent.input(input, { target: { value: 'x' } });
        await fireEvent.input(input, { target: { value: '' } });

        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'an empty field', props: {} },
      { name: 'a field with a value and a name', props: { defaultValue: '12', name: 'otp' } },
      { name: 'a controlled complete field', props: { value: '1234', name: 'otp' } },
      {
        name: 'a disabled, read-only and required field',
        props: { disabled: true, readOnly: true, required: true },
      },
      { name: 'a field with an id and no name', props: { id: 'code', validationType: 'alpha' } },
      { name: 'a field with a label before it', props: { label: 'before', description: true } },
      { name: 'a field with a label after it', props: { label: 'after', description: true } },
    ])('hydrates $name with no mismatch', async ({ props }) => {
      const serverHtml = await renderOnServer(
        'src/otp-field/root/OTPFieldRootHydration.test.vue',
        props,
      );

      await hydrate(OTPFieldRootHydration, { serverHtml, props });
    });
  });

  it.each([0, -1, 3.7, Number.NaN, Number.POSITIVE_INFINITY])(
    'warns when length is not a positive integer (%p)',
    async (invalidLength) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        await render(<OTPFieldBase.Root length={invalidLength} />);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0]?.[0]).toContain(
          `Vase UI: <OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(invalidLength)}}\`.`,
        );
      } finally {
        warnSpy.mockRestore();
      }
    },
  );
});
