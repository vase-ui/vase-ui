import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Teleport, defineComponent, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { Input } from '@vase-ui/vue/input';
import { OTPField as OTPFieldBase } from '@vase-ui/vue/otp-field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hiddenInputSizeTests,
  hydrate,
  pasteText,
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

  type OTPFieldProps = Omit<OTPFieldBase.Root.Props, 'length'> & {
    onValueChange?: (value: string, eventDetails: OTPFieldBase.Root.ChangeEventDetails) => void;
    onValueInvalid?: (value: string, eventDetails: OTPFieldBase.Root.InvalidEventDetails) => void;
    onValueComplete?: (value: string, eventDetails: OTPFieldBase.Root.CompleteEventDetails) => void;
    [key: `data-${string}`]: string;
  };

  function OTPField(props: OTPFieldProps) {
    return (
      <OTPFieldBase.Root length={OTP_LENGTH} {...props}>
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <OTPFieldBase.Input key={index} />
        ))}
      </OTPFieldBase.Root>
    );
  }

  hiddenInputSizeTests({
    render,
    createComponent: (props) => <OTPField {...props} />,
  });

  function getValues() {
    return screen
      .getAllByRole<HTMLInputElement>('textbox')
      .map((input) => input.value)
      .join('');
  }

  describe('value handling', () => {
    it('splits the default value across inputs', async () => {
      await render(<OTPField defaultValue="12a34b56" />);

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    it('clamps an overlong default value to the rendered slot count', async () => {
      await render(<OTPField defaultValue="12a34b56c7" name="otp" />);

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(inputs[0]).toHaveAttribute('maxlength', '6');
      inputs.slice(1).forEach((input) => {
        expect(input).not.toHaveAttribute('maxlength');
      });
      expect(hiddenInput).toHaveValue('123456');
    });

    it('assigns slot indexes from render order when omitted', async () => {
      await render(
        <OTPFieldBase.Root defaultValue="123" length={3}>
          <OTPFieldBase.Input />
          <OTPFieldBase.Input />
          <OTPFieldBase.Input />
        </OTPFieldBase.Root>,
      );

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3']);
    });

    it('supports grouped layouts without affecting slot counting', async () => {
      await render(
        <OTPFieldBase.Root defaultValue="123456" length={6}>
          <div data-testid="first-group">
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
          </div>
          <OTPFieldBase.Separator>-</OTPFieldBase.Separator>
          <div data-testid="second-group">
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
          </div>
        </OTPFieldBase.Root>,
      );

      const root = screen.getByRole('group');
      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(root).toContainElement(screen.getByTestId('first-group'));
      expect(root).toContainElement(screen.getByTestId('second-group'));
      expect(screen.getByText('-')).toBeVisible();
      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    it('updates the rendered value in controlled mode', async () => {
      const { rerender } = await render(<OTPField value="123456" />);

      expect(getValues()).toBe('123456');

      await rerender(<OTPField value="654321" />);

      expect(getValues()).toBe('654321');
    });

    describe('prop: validationType', () => {
      describe('built-in filtering', () => {
        it('supports alphabetic values when set to `alpha`', async () => {
          await render(<OTPField defaultValue="1a2b3Cd4" validationType="alpha" />);

          const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
          expect(inputs.map((input) => input.value)).toEqual(['a', 'b', 'C', 'd', '', '']);
        });

        it('supports typing alphabetic values when set to `alpha`', async () => {
          await render(<OTPField validationType="alpha" />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          await fireEvent.input(firstInput, { target: { value: '1a2b3C' } });

          expect(getValues()).toBe('abC');
        });

        it('supports alphanumeric values when set to `alphanumeric`', async () => {
          await render(<OTPField validationType="alphanumeric" />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          await fireEvent.input(firstInput, { target: { value: 'A1-B2c3' } });

          expect(getValues()).toBe('A1B2c3');
        });

        it('applies single-character validation to each visible slot', async () => {
          await render(<OTPField validationType="alphanumeric" />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

          expect(firstInput).toHaveAttribute('pattern', '[a-zA-Z0-9]{1}');
        });
      });

      describe('hidden validation input', () => {
        it('omits the hidden validation pattern when set to `none`', async () => {
          await render(<OTPField name="otp" validationType="none" />);

          const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

          expect(hiddenInput).not.toBeNull();
          expect(hiddenInput).not.toHaveAttribute('pattern');
        });

        it('allows a custom inputMode when validation is set to `none`', async () => {
          await render(<OTPField name="otp" validationType="none" inputMode="numeric" />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

          expect(firstInput).toHaveAttribute('inputmode', 'numeric');
          expect(hiddenInput).toHaveAttribute('inputmode', 'numeric');
        });

        it('allows overriding the built-in inputMode when needed', async () => {
          await render(<OTPField name="otp" validationType="numeric" inputMode="text" />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

          expect(firstInput).toHaveAttribute('inputmode', 'text');
          expect(hiddenInput).toHaveAttribute('inputmode', 'text');
        });
      });
    });

    describe('prop: normalizeValue', () => {
      it('supports custom normalization when `validationType` is `none`', async () => {
        await render(
          <OTPField
            validationType="none"
            normalizeValue={(value) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await fireEvent.input(firstInput, { target: { value: 'ab-12 cd' } });

        expect(getValues()).toBe('AB12CD');
      });

      it('composes with built-in validation and advances focus', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          await render(
            <OTPField
              validationType="alphanumeric"
              normalizeValue={(value) => value.toUpperCase()}
            />,
          );

          const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
          await fireEvent.input(inputs[0], { target: { value: 'a!' } });

          expect(getValues()).toBe('A');
          expect(inputs[1]).toHaveFocus();
          expect(warnSpy).not.toHaveBeenCalled();
        } finally {
          warnSpy.mockRestore();
        }
      });

      it('composes built-in validation and custom normalization for pasted values', async () => {
        await render(
          <OTPField
            validationType="alphanumeric"
            normalizeValue={(value) => value.toUpperCase()}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await pasteText(firstInput, 'ab-12 cd!');

        expect(getValues()).toBe('AB12CD');
      });

      it('composes built-in validation and custom normalization from a non-first slot', async () => {
        await render(
          <OTPField
            defaultValue="12"
            validationType="alphanumeric"
            normalizeValue={(value) => value.toUpperCase()}
          />,
        );

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        inputs[2].focus();
        await flushMicrotasks();

        await fireEvent.input(inputs[2], { target: { value: 'a!' } });

        expect(getValues()).toBe('12A');
        expect(inputs[3]).toHaveFocus();
      });
    });

    describe('prop: onValueChange', () => {
      it('fires `input-change` when typing', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField onValueChange={onValueChange} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await fireEvent.input(firstInput, { target: { value: '1' } });

        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0]?.[0]).toBe('1');
        expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires `input-clear` when clearing a slot by input', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField defaultValue="1" onValueChange={onValueChange} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await fireEvent.input(firstInput, { target: { value: '' } });

        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0]?.[0]).toBe('');
        expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputClear);
      });
    });

    describe('prop: onValueInvalid', () => {
      it('fires when typing is normalized before the OTP value updates', async () => {
        const onValueInvalid = vi.fn();

        await render(<OTPField onValueInvalid={onValueInvalid} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await fireEvent.input(firstInput, { target: { value: '1a' } });

        expect(getValues()).toBe('1');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1a');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires when custom normalization removes characters', async () => {
        const onValueInvalid = vi.fn();

        await render(
          <OTPField
            validationType="none"
            inputMode="numeric"
            normalizeValue={(value) => value.replace(/[^0-3]/g, '')}
            onValueInvalid={onValueInvalid}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await fireEvent.input(firstInput, { target: { value: '1209' } });

        expect(getValues()).toBe('120');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1209');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires when custom normalization removes characters after built-in validation', async () => {
        const onValueInvalid = vi.fn();

        await render(
          <OTPField
            validationType="numeric"
            normalizeValue={(value) => value.replace(/[^0-3]/g, '')}
            onValueInvalid={onValueInvalid}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await fireEvent.input(firstInput, { target: { value: '1209' } });

        expect(getValues()).toBe('120');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1209');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires when built-in validation removes characters before custom normalization expands the value', async () => {
        const onValueInvalid = vi.fn();

        await render(
          <OTPField
            validationType="numeric"
            normalizeValue={(value) => (value === '1' ? '12' : value)}
            onValueInvalid={onValueInvalid}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await fireEvent.input(firstInput, { target: { value: '1a' } });

        expect(getValues()).toBe('12');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1a');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires when custom normalization removes all characters after built-in validation', async () => {
        const onValueInvalid = vi.fn();

        await render(
          <OTPField
            validationType="numeric"
            normalizeValue={() => ''}
            onValueInvalid={onValueInvalid}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await fireEvent.input(firstInput, { target: { value: '1' } });

        expect(getValues()).toBe('');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires `input-paste` when pasted text is normalized before the OTP value updates', async () => {
        const onValueInvalid = vi.fn();

        await render(<OTPField onValueInvalid={onValueInvalid} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await pasteText(firstInput, '12a34');

        expect(getValues()).toBe('1234');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('12a34');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });

      it('fires `input-paste` when custom normalization removes characters after built-in validation', async () => {
        const onValueInvalid = vi.fn();

        await render(
          <OTPField
            validationType="numeric"
            normalizeValue={(value) => value.replace(/[^0-3]/g, '')}
            onValueInvalid={onValueInvalid}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await pasteText(firstInput, '1209');

        expect(getValues()).toBe('120');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1209');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });
    });

    describe('prop: onValueComplete', () => {
      it('fires when typing completes the OTP', async () => {
        const onValueComplete = vi.fn();

        await render(<OTPField onValueComplete={onValueComplete} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await fireEvent.input(firstInput, { target: { value: '123456' } });

        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires `input-paste` when pasting completes the OTP', async () => {
        const onValueComplete = vi.fn();

        await render(<OTPField onValueComplete={onValueComplete} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await pasteText(firstInput, '123456');

        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });

      it('fires `input-paste` when a complete paste replaces a complete OTP', async () => {
        const onValueComplete = vi.fn();

        await render(<OTPField onValueComplete={onValueComplete} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await pasteText(firstInput, '123456');
        await pasteText(firstInput, '654321');
        await pasteText(firstInput, '654321');

        expect(onValueComplete).toHaveBeenCalledTimes(3);
        expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
        expect(onValueComplete.mock.calls[1]?.[0]).toBe('654321');
        expect(onValueComplete.mock.calls[1]?.[1].reason).toBe(REASONS.inputPaste);
        expect(onValueComplete.mock.calls[2]?.[0]).toBe('654321');
        expect(onValueComplete.mock.calls[2]?.[1].reason).toBe(REASONS.inputPaste);
      });

      it('fires `input-paste` when pasting into a middle slot completes the OTP', async () => {
        const onValueComplete = vi.fn();

        await render(<OTPField defaultValue="12" onValueComplete={onValueComplete} />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        inputs[2].focus();
        await flushMicrotasks();

        await pasteText(inputs[2], '3456');

        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });

      it('does not fire when a completion-making paste is canceled', async () => {
        const onValueComplete = vi.fn();

        await render(
          <OTPField
            onValueChange={(_, eventDetails) => {
              eventDetails.cancel();
            }}
            onValueComplete={onValueComplete}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await pasteText(firstInput, '123456');

        expect(onValueComplete).not.toHaveBeenCalled();
      });

      it('does not fire before the OTP becomes complete', async () => {
        const onValueComplete = vi.fn();

        await render(<OTPField onValueComplete={onValueComplete} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await fireEvent.input(firstInput, { target: { value: '12345' } });

        expect(onValueComplete).not.toHaveBeenCalled();
      });

      it('does not fire later for a stale controlled completion attempt', async () => {
        vi.useFakeTimers();

        try {
          const onValueComplete = vi.fn();

          const Test = defineComponent(() => {
            const value = shallowRef('');
            const setValue = (nextValue: string) => {
              value.value = nextValue;
            };

            return () => (
              <>
                <OTPField
                  value={value.value}
                  onValueChange={() => {}}
                  onValueComplete={onValueComplete}
                />
                <button type="button" onClick={() => setValue('654321')}>
                  Apply value
                </button>
              </>
            );
          });

          await render(<Test />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          await fireEvent.input(firstInput, { target: { value: '123456' } });

          vi.runAllTimers();
          await flushMicrotasks();

          await fireEvent.click(screen.getByRole('button', { name: 'Apply value' }));

          expect(onValueComplete).not.toHaveBeenCalled();
        } finally {
          vi.useRealTimers();
        }
      });

      it('fires after an asynchronously accepted controlled completion', async () => {
        vi.useFakeTimers();

        try {
          const onValueComplete = vi.fn();

          const Test = defineComponent(() => {
            const value = shallowRef('');
            const setValue = (nextValue: string) => {
              value.value = nextValue;
            };

            return () => (
              <OTPField
                value={value.value}
                onValueChange={(nextValue) => {
                  setTimeout(() => {
                    setValue(nextValue);
                  }, 10);
                }}
                onValueComplete={onValueComplete}
              />
            );
          });

          await render(<Test />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          await fireEvent.input(firstInput, { target: { value: '123456' } });

          vi.runAllTimers();
          await flushMicrotasks();

          expect(onValueComplete).toHaveBeenCalledTimes(1);
          expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
          expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
        } finally {
          vi.useRealTimers();
        }
      });

      it('does not fire again when a controlled value changes from one complete value to another', async () => {
        const onValueComplete = vi.fn();

        const Test = defineComponent(() => {
          const value = shallowRef('123456');
          const setValue = (nextValue: string) => {
            value.value = nextValue;
          };

          return () => (
            <>
              <OTPField
                value={value.value}
                onValueChange={() => {}}
                onValueComplete={onValueComplete}
              />
              <button type="button" onClick={() => setValue('654321')}>
                Apply value
              </button>
            </>
          );
        });

        await render(<Test />);

        await fireEvent.click(screen.getByRole('button', { name: 'Apply value' }));

        expect(onValueComplete).not.toHaveBeenCalled();
      });
    });

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
    it('associates Field.Label with the first slot', async () => {
      await render(
        <Field.Root>
          <Field.Label>Verification code</Field.Label>
          <OTPField />
        </Field.Root>,
      );

      const label = screen.getByText('Verification code');
      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(label).toHaveAttribute('for', firstInput.id);
    });

    it('applies the Field description to the group', async () => {
      await render(
        <Field.Root>
          <Field.Label data-testid="label">Verification code</Field.Label>
          <Field.Description data-testid="description">Enter the code.</Field.Description>
          <OTPField aria-describedby="external-description" />
        </Field.Root>,
      );

      const label = screen.getByTestId('label');
      const description = screen.getByTestId('description');
      const group = screen.getByRole('group', { name: 'Verification code' });

      expect(group).toHaveAttribute('aria-labelledby', label.id);
      expect(group).toHaveAttribute('aria-describedby', `external-description ${description.id}`);
    });

    it('validates the latest value only after focus leaves the OTP field in onBlur mode', async () => {
      const validate = vi.fn(() => null);

      await render(
        <>
          <Form>
            <Field.Root name="otp" validationMode="onBlur" validate={validate}>
              <OTPField validationType="none" />
            </Field.Root>
          </Form>
          <button type="button">Outside</button>
        </>,
      );

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      inputs[0].focus();
      await flushMicrotasks();
      await fireEvent.input(inputs[0], { target: { value: '1' } });

      await fireEvent.focusOut(inputs[1], { relatedTarget: inputs[2] });
      expect(validate).not.toHaveBeenCalled();

      await fireEvent.focusOut(inputs[1], {
        relatedTarget: screen.getByRole('button', { name: 'Outside' }),
      });

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.calls[0]).toEqual(['1', { otp: '1' }]);
    });

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

  describe('accessibility', () => {
    it('forwards root `aria-describedby` to the group', async () => {
      await render(<OTPField aria-describedby="description-id" />);

      expect(screen.getByRole('group')).toHaveAttribute('aria-describedby', 'description-id');
    });

    it('forwards root `aria-labelledby` to the group only', async () => {
      await render(
        <>
          <span id="label-id">Verification code</span>
          <OTPField aria-labelledby="label-id" />
        </>,
      );

      const group = screen.getByRole('group', { name: 'Verification code' });
      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(group).toHaveAttribute('aria-labelledby', 'label-id');
      inputs.forEach((input) => {
        expect(input).not.toHaveAttribute('aria-labelledby', 'label-id');
      });
    });

    describe('prop: autoComplete', () => {
      it('applies the default autocomplete to the first slot only', async () => {
        await render(<OTPField />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        expect(inputs[0]).toHaveAttribute('autocomplete', 'one-time-code');
        expect(inputs[1]).toHaveAttribute('autocomplete', 'off');
      });

      it('allows overriding the autocomplete attribute', async () => {
        await render(<OTPField autoComplete="off" name="otp" />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
        const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

        expect(inputs[0]).toHaveAttribute('autocomplete', 'off');
        expect(hiddenInput).toHaveAttribute('autocomplete', 'off');
      });
    });
  });

  describe('prop: disabled', () => {
    it('disables every slot and prevents value changes', async () => {
      const onValueChange = vi.fn();

      await render(<OTPField disabled onValueChange={onValueChange} />);

      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(firstInput).toBeDisabled();
      expect(screen.getByRole('group')).toHaveAttribute('data-disabled', '');

      await fireEvent.input(firstInput, { target: { value: '1' } });

      expect(getValues()).toBe('');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: readOnly', () => {
    it('marks every slot as readonly and prevents value changes', async () => {
      const onValueChange = vi.fn();

      await render(<OTPField readOnly onValueChange={onValueChange} />);

      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(firstInput).toHaveAttribute('readonly');
      expect(screen.getByRole('group')).toHaveAttribute('data-readonly', '');

      await fireEvent.input(firstInput, { target: { value: '1' } });

      expect(getValues()).toBe('');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('tracks focus state when a readonly slot receives focus', async () => {
      await render(<OTPField readOnly />);

      const root = screen.getByRole('group');
      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

      firstInput.focus();
      await flushMicrotasks();

      expect(root).toHaveAttribute('data-focused', '');
    });
  });

  describe('prop: mask', () => {
    describe('native masking', () => {
      it('renders password slot inputs when enabled', async () => {
        await render(<OTPField defaultValue="123" mask />);

        expect(document.querySelectorAll('input[type="password"]')).toHaveLength(6);
      });
    });

    describe('slot overrides', () => {
      it('allows overriding the input type on individual slots', async () => {
        await render(
          <OTPFieldBase.Root length={1} mask>
            <OTPFieldBase.Input type="tel" />
          </OTPFieldBase.Root>,
        );

        expect(screen.getByRole('textbox')).toHaveAttribute('type', 'tel');
      });
    });
  });

  describe('interactions', () => {
    describe('typing', () => {
      it('fills consecutive slots when typing multiple characters into the first input', async () => {
        await render(<OTPField />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        await fireEvent.input(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
      });

      it('replaces consecutive slots when typing multiple characters into a later input', async () => {
        await render(<OTPField defaultValue="123456" />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        await fireEvent.input(inputs[2], { target: { value: '99' } });

        expect(getValues()).toBe('129956');
      });
    });

    describe('pasting', () => {
      it('fills consecutive slots when pasting a code', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField onValueChange={onValueChange} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        await pasteText(firstInput, '123456');

        expect(getValues()).toBe('123456');
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });
    });

    describe('external value changes', () => {
      it.each([
        { name: 'cleared', nextValue: '', expectedIndex: 0 },
        { name: 'shortened', nextValue: '12', expectedIndex: 2 },
      ])(
        'moves focus to the first empty slot when a controlled value is $name while focused',
        async ({ nextValue, expectedIndex }) => {
          const onValueChange = vi.fn();
          const { setProps } = await render(
            <OTPField value="111111" onValueChange={onValueChange} />,
          );

          const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

          inputs[5].focus();
          await flushMicrotasks();

          expect(inputs[5]).toHaveFocus();

          await setProps({ value: nextValue, onValueChange });

          expect(inputs[expectedIndex]).toHaveFocus();
          expect(inputs[expectedIndex]).toHaveAttribute('tabindex', '0');
          expect(inputs[5]).toHaveAttribute('tabindex', '-1');
        },
      );

      it('keeps focus on the tab stop when leading slots unmount as the value is cleared', async () => {
        const onValueChange = vi.fn();

        function TrailingSlots(props: { length: number; value: string }) {
          return (
            <OTPFieldBase.Root
              length={props.length}
              value={props.value}
              onValueChange={onValueChange}
            >
              {Array.from({ length: props.length }, (_, index) => (
                <OTPFieldBase.Input key={OTP_LENGTH - props.length + index} />
              ))}
            </OTPFieldBase.Root>
          );
        }

        const { setProps } = await render(<TrailingSlots length={OTP_LENGTH} value="123456" />);

        const lastInput = screen.getAllByRole<HTMLInputElement>('textbox')[5];

        lastInput.focus();
        await flushMicrotasks();

        expect(lastInput).toHaveFocus();

        // The slot-count dev warning lags one commit behind a runtime `length` change.
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        await setProps({ length: 3, value: '' });

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        expect(inputs).toHaveLength(3);
        expect(inputs[0]).toHaveFocus();
        expect(inputs[0]).toHaveAttribute('tabindex', '0');
        expect(inputs[2]).toHaveAttribute('tabindex', '-1');
      });

      it('keeps focus on a slot that is still reachable after a controlled value shrinks', async () => {
        const onValueChange = vi.fn();
        const { setProps } = await render(
          <OTPField value="111111" onValueChange={onValueChange} />,
        );

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        inputs[1].focus();
        await flushMicrotasks();

        await setProps({ value: '111', onValueChange });

        expect(inputs[1]).toHaveFocus();
      });

      it('does not move focus into the field when the value is cleared while focus is outside', async () => {
        const Test = defineComponent(() => {
          const value = shallowRef('111111');
          const setValue = (nextValue: string) => {
            value.value = nextValue;
          };

          return () => (
            <>
              <OTPField value={value.value} onValueChange={setValue} />
              <button type="button" onClick={() => setValue('')}>
                Clear
              </button>
            </>
          );
        });

        await render(<Test />);

        const button = screen.getByRole('button', { name: 'Clear' });

        button.focus();
        await flushMicrotasks();

        await fireEvent.click(button);

        expect(getValues()).toBe('');
        expect(button).toHaveFocus();
      });

      it('accepts typing and Backspace after a controlled clear while focused', async () => {
        vi.useFakeTimers();

        try {
          const Test = defineComponent(() => {
            const value = shallowRef('');
            const setValue = (nextValue: string) => {
              value.value = nextValue;
            };

            return () => (
              <OTPField
                value={value.value}
                onValueChange={setValue}
                onValueComplete={() => {
                  setTimeout(() => {
                    setValue('');
                  }, 300);
                }}
              />
            );
          });

          await render(<Test />);

          const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

          inputs[0].focus();
          await flushMicrotasks();

          await fireEvent.input(inputs[0], { target: { value: '111111' } });

          expect(inputs[5]).toHaveFocus();

          vi.advanceTimersByTime(300);
          await flushMicrotasks();

          expect(getValues()).toBe('');
          expect(inputs[0]).toHaveFocus();

          await fireEvent.input(inputs[0], { target: { value: '9' } });

          expect(inputs[1]).toHaveFocus();

          await fireEvent.input(inputs[1], { target: { value: '8' } });

          expect(getValues()).toBe('98');
          expect(inputs[2]).toHaveFocus();

          await fireEvent.keyDown(inputs[2], { key: 'Backspace' });

          expect(inputs[1]).toHaveFocus();

          await fireEvent.keyDown(inputs[1], { key: 'Backspace' });

          expect(getValues()).toBe('');
          expect(inputs[0]).toHaveFocus();
        } finally {
          vi.useRealTimers();
        }
      });
    });

    describe('keyboard', () => {
      it('removes a character and moves focus to the previous slot with backspace', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField defaultValue="1234" onValueChange={onValueChange} />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        inputs[1].focus();
        await flushMicrotasks();

        await fireEvent.keyDown(inputs[1], { key: 'Backspace' });

        expect(getValues()).toBe('134');
        expect(document.activeElement).toBe(inputs[0]);
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0]?.[0]).toBe('134');
        expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.keyboard);
      });

      it('does not fire `onValueChange` for Delete on an empty slot', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField defaultValue="1" onValueChange={onValueChange} />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        inputs[1].focus();
        await flushMicrotasks();

        await fireEvent.keyDown(inputs[1], { key: 'Delete' });

        expect(getValues()).toBe('1');
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('does not fire `onValueChange` for Backspace on an already-empty first slot', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField onValueChange={onValueChange} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        firstInput.focus();
        await flushMicrotasks();

        await fireEvent.keyDown(firstInput, { key: 'Backspace' });

        expect(getValues()).toBe('');
        expect(document.activeElement).toBe(firstInput);
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('does not move focus later for a stale controlled change', async () => {
        vi.useFakeTimers();

        try {
          const Test = defineComponent(() => {
            const value = shallowRef('');
            const setValue = (nextValue: string) => {
              value.value = nextValue;
            };

            return () => (
              <>
                <OTPField value={value.value} onValueChange={() => {}} />
                <button type="button" onClick={() => setValue('9')}>
                  Apply value
                </button>
              </>
            );
          });

          await render(<Test />);

          const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

          inputs[0].focus();
          await flushMicrotasks();

          await fireEvent.input(inputs[0], { target: { value: '1' } });

          vi.runAllTimers();
          await flushMicrotasks();

          await fireEvent.click(screen.getByRole('button', { name: 'Apply value' }));

          expect(document.activeElement).toBe(inputs[0]);
        } finally {
          vi.useRealTimers();
        }
      });

      it('moves focus after an asynchronously accepted controlled change', async () => {
        vi.useFakeTimers();

        try {
          const Test = defineComponent(() => {
            const value = shallowRef('');
            const setValue = (nextValue: string) => {
              value.value = nextValue;
            };

            return () => (
              <OTPField
                value={value.value}
                onValueChange={(nextValue) => {
                  setTimeout(() => {
                    setValue(nextValue);
                  }, 10);
                }}
              />
            );
          });

          await render(<Test />);

          const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

          inputs[0].focus();
          await flushMicrotasks();

          await fireEvent.input(inputs[0], { target: { value: '1' } });

          vi.runAllTimers();
          await flushMicrotasks();

          expect(document.activeElement).toBe(inputs[1]);
        } finally {
          vi.useRealTimers();
        }
      });
    });
  });

  describe('Form', () => {
    it('blocks form submission while the code is incomplete', async () => {
      await render(
        <form data-testid="form">
          <OTPField defaultValue="123" name="otp" required />
          <button type="submit">Submit</button>
        </form>,
      );

      expect(screen.getByTestId<HTMLFormElement>('form').checkValidity()).toBe(false);
    });

    it('allows form submission when the code is complete', async () => {
      await render(
        <form data-testid="form">
          <OTPField defaultValue="123456" name="otp" required />
          <button type="submit">Submit</button>
        </form>,
      );

      expect(screen.getByTestId<HTMLFormElement>('form').checkValidity()).toBe(true);
    });

    it('renders the hidden validation input with the provided name', async () => {
      await render(<OTPField name="otp" />);

      expect(document.querySelector('input[name="otp"]')).not.toBeNull();
    });

    it('redirects hidden validation input focus to the first visible slot', async () => {
      await render(<OTPField name="otp" />);

      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

      expect(hiddenInput).not.toBeNull();

      hiddenInput!.focus();
      await flushMicrotasks();

      expect(firstInput).toHaveFocus();
    });

    it('accepts valid hidden-input autofill and moves focus to the first slot when autofill is cleared', async () => {
      const onValueChange = vi.fn();
      const onValueInvalid = vi.fn();

      await render(
        <OTPField name="otp" onValueChange={onValueChange} onValueInvalid={onValueInvalid} />,
      );

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

      expect(hiddenInput).not.toBeNull();

      await fireEvent.input(hiddenInput!, { target: { value: '123456' } });

      expect(getValues()).toBe('123456');
      expect(inputs[5]).toHaveFocus();
      expect(onValueInvalid).not.toHaveBeenCalled();

      await fireEvent.input(hiddenInput!, { target: { value: '' } });

      expect(getValues()).toBe('');
      expect(inputs[0]).toHaveFocus();
      expect(inputs[0]).toHaveAttribute('tabindex', '0');
      expect(inputs[5]).toHaveAttribute('tabindex', '-1');
      expect(onValueChange.mock.calls.map((call) => call[0])).toEqual(['123456', '']);
      expect(onValueInvalid).not.toHaveBeenCalled();
    });

    it('handles password manager autofill through the hidden input', async () => {
      const onValueChange = vi.fn();
      const onValueInvalid = vi.fn();
      const onValueComplete = vi.fn();

      await render(
        <OTPField
          name="otp"
          onValueChange={onValueChange}
          onValueInvalid={onValueInvalid}
          onValueComplete={onValueComplete}
        />,
      );

      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

      expect(hiddenInput).not.toBeNull();

      await fireEvent.input(hiddenInput!, { target: { value: '12a34b56' } });

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(document.activeElement).toBe(inputs[5]);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('123456');
      expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      expect(onValueInvalid).toHaveBeenCalledTimes(1);
      expect(onValueInvalid.mock.calls[0]?.[0]).toBe('12a34b56');
      expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      expect(onValueComplete.mock.calls.length).toBe(1);
      expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
      expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
    });

    it('composes validation and custom normalization during hidden input autofill', async () => {
      const onValueChange = vi.fn();
      const onValueInvalid = vi.fn();
      const onValueComplete = vi.fn();

      await render(
        <OTPField
          name="otp"
          validationType="alphanumeric"
          normalizeValue={(value) => value.toUpperCase()}
          onValueChange={onValueChange}
          onValueInvalid={onValueInvalid}
          onValueComplete={onValueComplete}
        />,
      );

      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

      expect(hiddenInput).not.toBeNull();

      await fireEvent.input(hiddenInput!, { target: { value: 'ab-12 cd!' } });

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(inputs.map((input) => input.value)).toEqual(['A', 'B', '1', '2', 'C', 'D']);
      expect(document.activeElement).toBe(inputs[5]);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('AB12CD');
      expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      expect(onValueInvalid).toHaveBeenCalledTimes(1);
      expect(onValueInvalid.mock.calls[0]?.[0]).toBe('ab-12 cd!');
      expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      expect(onValueComplete.mock.calls.length).toBe(1);
      expect(onValueComplete.mock.calls[0]?.[0]).toBe('AB12CD');
      expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
    });

    it.each([
      { lockState: 'readOnly', ariaInvalid: 'true' },
      { lockState: 'disabled', ariaInvalid: null },
    ] as const)(
      'ignores hidden-input autofill when $lockState inside Field',
      async ({ lockState, ariaInvalid }) => {
        const onValueChange = vi.fn();
        const onValueInvalid = vi.fn();
        const onValueComplete = vi.fn();

        await render(
          <Form errors={{ otp: 'test' }}>
            <Field.Root name="otp">
              <OTPField
                readOnly={lockState === 'readOnly'}
                disabled={lockState === 'disabled'}
                onValueChange={onValueChange}
                onValueInvalid={onValueInvalid}
                onValueComplete={onValueComplete}
              />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );

        const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

        expect(hiddenInput).not.toBeNull();
        expect(screen.getByTestId('error')).toHaveTextContent('test');
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.map((input) => input.getAttribute('aria-invalid'))).toEqual(
          inputs.map(() => ariaInvalid),
        );

        await fireEvent.input(hiddenInput!, { target: { value: '12a34b56' } });

        expect(getValues()).toBe('');
        expect(onValueChange).not.toHaveBeenCalled();
        expect(onValueInvalid).not.toHaveBeenCalled();
        expect(onValueComplete).not.toHaveBeenCalled();
        expect(screen.getByTestId('error')).toHaveTextContent('test');
      },
    );

    it.each([{ lockState: 'readOnly' }, { lockState: 'disabled' }] as const)(
      'ignores hidden-input autofill when $lockState outside Field',
      async ({ lockState }) => {
        const onValueChange = vi.fn();
        const onValueInvalid = vi.fn();
        const onValueComplete = vi.fn();

        await render(
          <OTPField
            readOnly={lockState === 'readOnly'}
            disabled={lockState === 'disabled'}
            name="otp"
            onValueChange={onValueChange}
            onValueInvalid={onValueInvalid}
            onValueComplete={onValueComplete}
          />,
        );

        const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

        expect(hiddenInput).not.toBeNull();
        // Without a Field wrapper, nothing marks the inputs invalid.
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.map((input) => input.getAttribute('aria-invalid'))).toEqual(
          inputs.map(() => null),
        );

        await fireEvent.input(hiddenInput!, { target: { value: '12a34b56' } });

        expect(getValues()).toBe('');
        expect(onValueChange).not.toHaveBeenCalled();
        expect(onValueInvalid).not.toHaveBeenCalled();
        expect(onValueComplete).not.toHaveBeenCalled();
      },
    );

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
      it('does not auto-submit the owning form when the OTP becomes complete by default', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
        });

        await render(
          <form onSubmit={handleSubmit}>
            <OTPField />
            <button type="submit">Submit</button>
          </form>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        await fireEvent.input(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
        expect(handleSubmit).not.toHaveBeenCalled();
      });

      it('submits its own form when an unscoped control in another form mounts later', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
        });
        const handleOtherSubmit = vi.fn((event: Event) => {
          event.preventDefault();
        });

        await render(
          <>
            <form onSubmit={handleSubmit}>
              <OTPField autoSubmit />
            </form>
            <form onSubmit={handleOtherSubmit}>
              <Input aria-label="Unrelated input" />
            </form>
          </>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        await fireEvent.input(firstInput, { target: { value: '123456' } });

        expect(handleSubmit).toHaveBeenCalledTimes(1);
        expect(handleOtherSubmit).not.toHaveBeenCalled();
      });

      it.each([
        {
          name: 'the root is portaled through render',
          renderOTPField: () => (
            <OTPFieldBase.Root
              length={OTP_LENGTH}
              autoSubmit
              v-slots={{
                render: ({ props }: { props: Record<string, any> }) => (
                  <Teleport to={document.body}>
                    <div {...props}>
                      {Array.from({ length: OTP_LENGTH }, (_, index) => (
                        <OTPFieldBase.Input key={index} />
                      ))}
                    </div>
                  </Teleport>
                ),
              }}
            />
          ),
        },
        {
          name: 'the inputs are portaled',
          renderOTPField: () => (
            <OTPFieldBase.Root length={OTP_LENGTH} autoSubmit>
              <Teleport to={document.body}>
                {Array.from({ length: OTP_LENGTH }, (_, index) => (
                  <OTPFieldBase.Input key={index} />
                ))}
              </Teleport>
            </OTPFieldBase.Root>
          ),
        },
      ])('submits the hidden input form when $name', async ({ renderOTPField }) => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
        });

        await render(<form onSubmit={handleSubmit}>{renderOTPField()}</form>);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        expect(firstInput.form).toBe(null);

        await fireEvent.input(firstInput, { target: { value: '123456' } });

        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('submits the completed named OTP value from the owning form when enabled', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();

          expect(new FormData(event.currentTarget as HTMLFormElement).get('otp')).toBe('123456');
        });

        await render(
          <form onSubmit={handleSubmit}>
            <OTPField name="otp" required autoSubmit />
            <button type="submit">Submit</button>
          </form>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        await fireEvent.input(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('keeps the completed value when the owning form has no requestSubmit method', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
        });
        const onValueComplete = vi.fn();

        await render(
          <form aria-label="verification" onSubmit={handleSubmit}>
            <OTPField name="otp" autoSubmit onValueComplete={onValueComplete} />
          </form>,
        );

        const form = screen.getByRole<HTMLFormElement>('form', { name: 'verification' });
        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        Object.defineProperty(form, 'requestSubmit', { configurable: true, value: undefined });

        await fireEvent.input(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(handleSubmit).not.toHaveBeenCalled();
      });

      it('does not call flushSync inside a layout effect when auto-submitting a Base UI Form', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
        });

        await render(
          <Form onSubmit={handleSubmit}>
            <Field.Root name="otp">
              <OTPField autoSubmit />
            </Field.Root>
          </Form>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        await fireEvent.input(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('blocks invalid Base UI Form auto-submit without calling flushSync inside a layout effect', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
        });

        await render(
          <Form onSubmit={handleSubmit}>
            <Field.Root name="otp" validate={() => 'Invalid OTP'}>
              <OTPField autoSubmit />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        await fireEvent.input(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
        expect(handleSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid OTP');
      });

      it('keeps focus on the first invalid field when auto-submit is blocked', async () => {
        await render(
          <Form>
            <Field.Root name="email" validate={() => 'Required'}>
              <Field.Label>Email</Field.Label>
              <Field.Control />
              <Field.Error />
            </Field.Root>
            <Field.Root name="otp">
              <OTPField autoSubmit />
            </Field.Root>
          </Form>,
        );

        const emailInput = screen.getByRole('textbox', { name: 'Email' });
        const otpInputs = screen
          .getAllByRole<HTMLInputElement>('textbox')
          .filter((input) => input !== emailInput);

        await fireEvent.input(otpInputs[0], { target: { value: '123456' } });

        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveFocus();
      });

      it('does not submit the owning form before the OTP becomes complete when enabled', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
        });

        await render(
          <form onSubmit={handleSubmit}>
            <OTPField autoSubmit />
            <button type="submit">Submit</button>
          </form>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        await fireEvent.input(firstInput, { target: { value: '12345' } });

        expect(getValues()).toBe('12345');
        expect(handleSubmit).not.toHaveBeenCalled();
      });

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

    describe('prop: form', () => {
      it('submits an associated external form when used with `autoSubmit`', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();

          expect(new FormData(event.currentTarget as HTMLFormElement).get('otp')).toBe('123456');
        });

        await render(
          <>
            <form id="verification-form" onSubmit={handleSubmit}>
              <button type="submit">Submit</button>
            </form>
            <OTPField form="verification-form" name="otp" autoSubmit />
          </>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        await fireEvent.input(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('does not submit an ancestor form when the explicit form id is not a form', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
        });

        await render(
          <>
            <div id="verification-form" />
            <form onSubmit={handleSubmit}>
              <OTPField form="verification-form" name="otp" autoSubmit />
            </form>
          </>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        await fireEvent.input(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
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

  describe('[data-focused] without a blur event', () => {
    function Fields(props: { firstMounted?: boolean; firstDisabled?: boolean }) {
      const { firstMounted = true, firstDisabled = false } = props;
      return (
        <Field.Root data-testid="field">
          {firstMounted && <OTPField data-testid="first" disabled={firstDisabled} />}
        </Field.Root>
      );
    }

    it('is removed when the focused field becomes disabled', async () => {
      const { setProps } = await render(<Fields />);

      screen.getAllByRole<HTMLInputElement>('textbox')[0].focus();
      await flushMicrotasks();

      expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
      expect(screen.getByTestId('first')).toHaveAttribute('data-focused', '');

      await setProps({ firstDisabled: true });

      expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
      expect(screen.getByTestId('first')).not.toHaveAttribute('data-focused');
    });

    it('is removed when the focused field unmounts', async () => {
      const { setProps } = await render(<Fields />);

      screen.getAllByRole<HTMLInputElement>('textbox')[0].focus();
      await flushMicrotasks();

      expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');

      await setProps({ firstMounted: false });

      expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
    });

    it('is kept when a previously focused slot unmounts after focus moves to a sibling', async () => {
      // `inputCount` trails `length` by a render, so shrinking both at once warns about a
      // mismatch that never reaches the DOM. Silencing it keeps the test from passing only on
      // CI's retry, where `warn`'s dedupe swallows the message it failed on the first time.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      function TestCase(props: { firstMounted?: boolean }) {
        const { firstMounted = true } = props;
        return (
          <Field.Root data-testid="field">
            <OTPFieldBase.Root length={firstMounted ? 3 : 2} defaultValue="1" data-testid="otp">
              {firstMounted && <OTPFieldBase.Input key="first" />}
              <OTPFieldBase.Input key="second" />
              <OTPFieldBase.Input key="third" />
            </OTPFieldBase.Root>
          </Field.Root>
        );
      }

      try {
        const { setProps } = await render(<TestCase />);
        const [first, second] = screen.getAllByRole<HTMLInputElement>('textbox');

        first.focus();
        await flushMicrotasks();
        second.focus();
        await flushMicrotasks();

        expect(second).toHaveFocus();
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
        expect(screen.getByTestId('otp')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(second).toHaveFocus();
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
        expect(screen.getByTestId('otp')).toHaveAttribute('data-focused', '');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('is removed when the focused slot unmounts but its field remains', async () => {
      // Unmounting one slot leaves `length` out of sync with the rendered inputs, which is
      // irrelevant to what this test asserts. `warn` dedupes on the message, so `length={3}`
      // keeps this silenced warning from consuming the messages other tests assert.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      function TestCase(props: { firstMounted?: boolean }) {
        const { firstMounted = true } = props;
        return (
          <Field.Root data-testid="field">
            <OTPFieldBase.Root length={3} data-testid="otp">
              {firstMounted && <OTPFieldBase.Input />}
              <OTPFieldBase.Input />
              <OTPFieldBase.Input />
            </OTPFieldBase.Root>
          </Field.Root>
        );
      }

      try {
        const { setProps } = await render(<TestCase />);

        screen.getAllByRole<HTMLInputElement>('textbox')[0].focus();
        await flushMicrotasks();
        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
        expect(screen.getByTestId('otp')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
        expect(screen.getByTestId('otp')).not.toHaveAttribute('data-focused');
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  it('updates standalone filled and focused state on the root', async () => {
    await render(<OTPField data-testid="root" />);

    const root = screen.getByTestId('root');
    const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

    expect(root).not.toHaveAttribute('data-filled');
    expect(root).not.toHaveAttribute('data-focused');

    firstInput.focus();
    await flushMicrotasks();

    expect(root).toHaveAttribute('data-focused', '');

    await fireEvent.input(firstInput, { target: { value: '1' } });

    expect(root).toHaveAttribute('data-filled', '');

    await fireEvent.focusOut(firstInput);

    expect(root).not.toHaveAttribute('data-focused');
  });

  it('sets `data-complete` when all slots are filled', async () => {
    await render(<OTPField data-testid="root" defaultValue="123456" />);

    expect(screen.getByTestId('root')).toHaveAttribute('data-complete', '');
  });

  it('renders a fallback hidden input id when name is not provided', async () => {
    await render(<OTPField id="verification-code" />);

    expect(document.querySelector('#verification-code-hidden-input')).not.toBeNull();
  });

  it('warns when length does not match the rendered input count', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockName('console.warn')
      .mockImplementation(() => {});

    await render(
      <OTPFieldBase.Root length={OTP_LENGTH}>
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
      </OTPFieldBase.Root>,
    );

    expect(warnSpy.mock.calls.length).toBe(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(
      'Vase UI: <OTPField.Root> `length` must match the number of rendered <OTPField.Input /> parts.',
    );
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Received `length={6}` but rendered 5 inputs.');

    warnSpy.mockRestore();
  });

  it('warns with singular input wording when one input is rendered', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <OTPFieldBase.Root length={2}>
          <OTPFieldBase.Input />
        </OTPFieldBase.Root>,
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain('Received `length={2}` but rendered 1 input.');
    } finally {
      warnSpy.mockRestore();
    }
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
