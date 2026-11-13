import { expect, vi, describe, it } from 'vitest';
import { shallowRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { Field } from '@vase-ui/vue/field';
import { OTPField } from '@vase-ui/vue/otp-field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  pasteText,
  screen,
  takeReportedMessages,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';

describe('<OTPField.Input />', () => {
  const { render } = createRenderer();
  const OTP_LENGTH = 6;
  const modifierKeys = [
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
  ] as const;

  describeConformance(<OTPField.Input />, () => ({
    refInstanceof: window.HTMLInputElement,
    testRenderPropWith: 'input',
    render(node) {
      return render(<OTPField.Root length={1}>{node}</OTPField.Root>);
    },
  }));

  type OTPFieldTestProps = Omit<OTPField.Root.Props, 'length'> & {
    onValueChange?: (value: string, eventDetails: OTPField.Root.ChangeEventDetails) => void;
    onValueInvalid?: (value: string, eventDetails: OTPField.Root.InvalidEventDetails) => void;
    onValueComplete?: (value: string, eventDetails: OTPField.Root.CompleteEventDetails) => void;
  };

  function OTPFieldTest(props: OTPFieldTestProps) {
    return (
      <OTPField.Root length={OTP_LENGTH} {...props}>
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <OTPField.Input key={index} />
        ))}
      </OTPField.Root>
    );
  }

  function pasteWithError(target: HTMLElement, error: Error) {
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData() {
          throw error;
        },
      },
    });

    return fireEvent(target, pasteEvent);
  }

  it('renders one textbox per slot', async () => {
    await render(<OTPFieldTest />);

    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });

  it('moves focus with arrow keys', async () => {
    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inputs[2]);

    await fireEvent.keyDown(inputs[2], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('moves focus with arrow keys in RTL', async () => {
    await render(
      <DirectionProvider direction="rtl">
        <OTPFieldTest defaultValue="12" />
      </DirectionProvider>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(inputs[2]);

    await fireEvent.keyDown(inputs[2], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('redirects focus to the first empty slot when a later empty slot is focused', async () => {
    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[4].focus();
    await flushMicrotasks();

    expect(document.activeElement).toBe(inputs[2]);
  });

  it('moves focus to the next slot after typing', async () => {
    await render(<OTPFieldTest />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[0].focus();
    await flushMicrotasks();

    await fireEvent.input(inputs[0], { target: { value: '1' } });

    expect(document.activeElement).toBe(inputs[1]);
  });

  it('selects the last slot after typing into it for the first time', async () => {
    await render(<OTPFieldTest defaultValue="12345" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
    const lastInput = inputs[5];

    lastInput.focus();
    await flushMicrotasks();

    await fireEvent.input(lastInput, { target: { value: '6' } });

    expect(document.activeElement).toBe(lastInput);
    expect(lastInput.selectionStart).toBe(0);
    expect(lastInput.selectionEnd).toBe(1);
  });

  it('keeps focus in place when typing is canceled', async () => {
    await render(
      <OTPFieldTest
        onValueChange={(_, eventDetails) => {
          eventDetails.cancel();
        }}
      />,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[0].focus();
    await flushMicrotasks();

    await fireEvent.input(inputs[0], { target: { value: '1' } });

    expect(inputs.map((input) => input.value)).toEqual(['', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('keeps the filled slot selected when typing an invalid character', async () => {
    await render(<OTPFieldTest defaultValue="1" />);

    const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

    firstInput.focus();
    await flushMicrotasks();

    await fireEvent.input(firstInput, { target: { value: 'a' } });

    expect(firstInput).toHaveValue('1');
    expect(document.activeElement).toBe(firstInput);
    expect(firstInput.selectionStart).toBe(0);
    expect(firstInput.selectionEnd).toBe(1);
  });

  it('commits an IME composition once on compositionend instead of per intermediate change', async () => {
    const onValueChange = vi.fn();

    await render(<OTPFieldTest validationType="alphanumeric" onValueChange={onValueChange} />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
    const firstInput = inputs[0];

    firstInput.focus();
    await flushMicrotasks();

    await fireEvent.compositionStart(firstInput);

    // Safari can surface in-progress IME text through `change` as an accumulating string.
    await fireEvent.input(firstInput, { target: { value: 'd' } });
    await fireEvent.input(firstInput, { target: { value: 'dd' } });
    await fireEvent.input(firstInput, { target: { value: 'ddd' } });

    // No value commits while the composition is active; the text is only buffered for display.
    expect(onValueChange).not.toHaveBeenCalled();
    expect(inputs.map((input) => input.value)).toEqual(['ddd', '', '', '', '', '']);

    await fireEvent.compositionEnd(firstInput, { target: { value: 'ddd' } });

    // The final composed value commits once across three slots, not six.
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith('ddd', expect.anything());
    expect(inputs.map((input) => input.value)).toEqual(['d', 'd', 'd', '', '', '']);
    expect(document.activeElement).toBe(inputs[3]);
  });

  it('reports characters rejected from a committed IME composition', async () => {
    const onValueChange = vi.fn();
    const onValueInvalid = vi.fn();

    await render(<OTPFieldTest onValueChange={onValueChange} onValueInvalid={onValueInvalid} />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
    const firstInput = inputs[0];

    firstInput.focus();
    await flushMicrotasks();

    await fireEvent.compositionStart(firstInput);
    await fireEvent.input(firstInput, { target: { value: '1a' } });

    expect(onValueInvalid).not.toHaveBeenCalled();

    await fireEvent.compositionEnd(firstInput, { target: { value: '1a' } });

    expect(onValueInvalid).toHaveBeenCalledTimes(1);
    expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1a');
    expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith('1', expect.anything());
    expect(inputs.map((input) => input.value)).toEqual(['1', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('ignores keyboard commands while a composition is buffered', async () => {
    const onValueChange = vi.fn();

    await render(
      <OTPFieldTest
        validationType="alphanumeric"
        defaultValue="12"
        onValueChange={onValueChange}
      />,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
    const thirdInput = inputs[2];

    thirdInput.focus();
    await flushMicrotasks();

    await fireEvent.compositionStart(thirdInput);
    await fireEvent.input(thirdInput, { target: { value: 'a' } });

    // iOS Safari fires a real `Backspace` keydown while the IME is still composing.
    await fireEvent.keyDown(thirdInput, { key: 'Backspace' });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(thirdInput);
    expect(inputs.map((input) => input.value)).toEqual(['1', '2', 'a', '', '', '']);

    // The IME deleted its own text, so the composition ends empty and nothing commits.
    await fireEvent.compositionEnd(thirdInput, { target: { value: '' } });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '', '', '', '']);
  });

  it.each([{ prop: 'disabled' as const }, { prop: 'readOnly' as const }])(
    'does not commit a composition that ends after the field becomes $prop',
    async ({ prop }) => {
      const onValueChange = vi.fn();

      const { setProps } = await render(
        <OTPFieldTest validationType="alphanumeric" onValueChange={onValueChange} />,
      );

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
      const firstInput = inputs[0];

      firstInput.focus();
      await flushMicrotasks();

      await fireEvent.compositionStart(firstInput);
      await fireEvent.input(firstInput, { target: { value: 'abc' } });

      await setProps({ [prop]: true });

      await fireEvent.compositionEnd(firstInput, { target: { value: 'abc' } });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(inputs.map((input) => input.value)).toEqual(['', '', '', '', '', '']);
    },
  );

  it('selects the slot value on mousedown', async () => {
    await render(<OTPFieldTest defaultValue="1" />);

    const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

    await fireEvent.mouseDown(firstInput);

    expect(firstInput.selectionStart).toBe(0);
    expect(firstInput.selectionEnd).toBe(1);
  });

  it('allows a composed mousedown handler to prevent focus', async () => {
    await render(
      <OTPField.Root length={2}>
        <OTPField.Input
          onMousedown={(event) => {
            event.preventDefault();
          }}
        />
        <OTPField.Input />
      </OTPField.Root>,
    );

    const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

    expect(await fireEvent.mouseDown(firstInput)).toBe(false);
    expect(firstInput).not.toHaveFocus();
  });

  it('allows a composed focus handler to prevent internal focus state', async () => {
    await render(
      <OTPField.Root data-testid="root" length={1}>
        <OTPField.Input
          onFocusin={(event) => {
            event.preventVaseUIHandler();
          }}
        />
      </OTPField.Root>,
    );

    const root = screen.getByTestId('root');
    const input = screen.getByRole<HTMLInputElement>('textbox');

    input.focus();
    await flushMicrotasks();

    expect(input).toHaveFocus();
    expect(root).not.toHaveAttribute('data-focused');
  });

  it('allows a composed blur handler to preserve internal focus state', async () => {
    await render(
      <>
        <OTPField.Root data-testid="root" length={1}>
          <OTPField.Input
            onFocusout={(event) => {
              event.preventVaseUIHandler();
            }}
          />
        </OTPField.Root>
        <button type="button">Outside</button>
      </>,
    );

    const root = screen.getByTestId('root');
    const input = screen.getByRole<HTMLInputElement>('textbox');
    const outside = screen.getByRole('button', { name: 'Outside' });

    input.focus();
    await flushMicrotasks();
    expect(root).toHaveAttribute('data-focused', '');

    outside.focus();
    await flushMicrotasks();

    expect(outside).toHaveFocus();
    expect(root).toHaveAttribute('data-focused', '');
  });

  it('moves focus to the next slot when typing the same character into a filled slot', async () => {
    const { user } = await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    await user.keyboard('2');

    expect(document.activeElement).toBe(inputs[2]);
  });

  it.each([
    ['ArrowUp', 0],
    ['ArrowDown', 4],
  ] as const)('moves focus to the field boundary with %s', async (key, targetIndex) => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    expect(await fireEvent.keyDown(inputs[1], { key })).toBe(false);
    expect(inputs[targetIndex]).toHaveFocus();
  });

  it('stops propagation when ArrowDown moves focus to the empty end slot', async () => {
    const onKeyDown = vi.fn();

    await render(
      <div onKeydown={onKeyDown}>
        <OTPFieldTest defaultValue="1234" />
      </div>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    expect(await fireEvent.keyDown(inputs[1], { key: 'ArrowDown' })).toBe(false);
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(inputs[4]).toHaveFocus();
  });

  it('keeps focus on the empty end slot with ArrowDown', async () => {
    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[2].focus();
    await flushMicrotasks();

    expect(await fireEvent.keyDown(inputs[2], { key: 'ArrowDown' })).toBe(false);
    expect(inputs[2]).toHaveFocus();
  });

  it('keeps focus on the final slot with ArrowDown when the value is complete', async () => {
    await render(<OTPFieldTest defaultValue="123456" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[5].focus();
    await flushMicrotasks();

    expect(await fireEvent.keyDown(inputs[5], { key: 'ArrowDown' })).toBe(false);
    expect(inputs[5]).toHaveFocus();
  });

  it('does not reselect the final slot when typing the same character', async () => {
    const { user } = await render(<OTPFieldTest defaultValue="123456" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
    const lastInput = inputs[5];

    lastInput.focus();
    await flushMicrotasks();

    const select = vi.spyOn(lastInput, 'select');

    try {
      await user.keyboard('6');

      expect(select).not.toHaveBeenCalled();
      expect(lastInput).toHaveFocus();
    } finally {
      select.mockRestore();
    }
  });

  it('moves focus to the first slot with Home', async () => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[3].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[3], { key: 'Home' });

    expect(document.activeElement).toBe(inputs[0]);
  });

  it('moves focus to the empty end slot with End', async () => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[0].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[0], { key: 'End' });

    expect(document.activeElement).toBe(inputs[4]);
  });

  it.each(modifierKeys)(
    'moves focus to the field boundaries with %s + arrow keys',
    async (_, modifierKey) => {
      await render(<OTPFieldTest defaultValue="1234" />);

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      inputs[2].focus();
      await flushMicrotasks();

      await fireEvent.keyDown(inputs[2], { key: 'ArrowLeft', ...modifierKey });
      expect(document.activeElement).toBe(inputs[0]);

      await fireEvent.keyDown(inputs[0], { key: 'ArrowRight', ...modifierKey });
      expect(document.activeElement).toBe(inputs[4]);
    },
  );

  it.each(modifierKeys)(
    'moves focus to the field boundaries with %s + arrow keys in RTL',
    async (_, modifierKey) => {
      await render(
        <DirectionProvider direction="rtl">
          <OTPFieldTest defaultValue="1234" />
        </DirectionProvider>,
      );

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      inputs[2].focus();
      await flushMicrotasks();

      await fireEvent.keyDown(inputs[2], { key: 'ArrowLeft', ...modifierKey });
      expect(document.activeElement).toBe(inputs[4]);

      await fireEvent.keyDown(inputs[4], { key: 'ArrowRight', ...modifierKey });
      expect(document.activeElement).toBe(inputs[0]);
    },
  );

  it('keeps arrow and home/end navigation working in readonly mode', async () => {
    await render(<OTPFieldTest defaultValue="1234" readOnly />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inputs[2]);

    await fireEvent.keyDown(inputs[2], { key: 'Home' });
    expect(document.activeElement).toBe(inputs[0]);

    await fireEvent.keyDown(inputs[0], { key: 'End' });
    expect(document.activeElement).toBe(inputs[4]);

    await fireEvent.keyDown(inputs[4], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(inputs[0]);

    await fireEvent.keyDown(inputs[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(inputs[4]);
  });

  it('leaves vertical arrow navigation unhandled in disabled mode', async () => {
    const onKeyDown = vi.fn();

    await render(
      <div onKeydown={onKeyDown}>
        <OTPFieldTest defaultValue="12" disabled />
      </div>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    const arrowUpEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowUp',
    });
    const arrowDownEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowDown',
    });

    expect(inputs[1].dispatchEvent(arrowUpEvent)).toBe(true);
    expect(inputs[1].dispatchEvent(arrowDownEvent)).toBe(true);
    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });

  it('blocks Delete and Backspace from changing the value in readonly mode', async () => {
    await render(<OTPFieldTest defaultValue="1234" readOnly />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[1], { key: 'Delete' });
    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);

    await fireEvent.keyDown(inputs[1], { key: 'Backspace' });
    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('blocks paste from changing the value in readonly mode', async () => {
    await render(<OTPFieldTest defaultValue="1234" readOnly />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    await pasteText(inputs[1], '99');

    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('warns in development when clipboard text cannot be read during paste handling', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(<OTPFieldTest defaultValue="12" />);

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      inputs[1].focus();
      await flushMicrotasks();

      await pasteWithError(inputs[1], new DOMException('Blocked', 'SecurityError'));

      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '', '', '', '']);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain(
        'Vase UI: <OTPField.Input> could not read clipboard text during paste handling.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('ignores a paste event when clipboard text is unavailable', async () => {
    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });

    expect(inputs[1].dispatchEvent(pasteEvent)).toBe(false);
    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '', '', '', '']);
  });

  it('allows tabbing out of the field from the active slot', async () => {
    const { user } = await render(
      <>
        <OTPFieldTest />
        <button type="button">Next</button>
      </>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[0].focus();
    await flushMicrotasks();

    await fireEvent.input(inputs[0], { target: { value: '1' } });
    expect(document.activeElement).toBe(inputs[1]);

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }));
  });

  it('deletes the current character and moves focus to the previous slot on backspace', async () => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[1], { key: 'Backspace' });

    expect(inputs.map((input) => input.value)).toEqual(['1', '3', '4', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('deletes the previous filled slot when backspacing on an empty non-first slot', async () => {
    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[2].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[2], { key: 'Backspace' });

    expect(inputs.map((input) => input.value)).toEqual(['1', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it.each(modifierKeys)('clears all slots with %s + Backspace', async (_, modifierKey) => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[2].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[2], { key: 'Backspace', ...modifierKey });

    expect(inputs.map((input) => input.value)).toEqual(['', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('keeps focus in place when backspace is canceled', async () => {
    await render(
      <OTPFieldTest
        defaultValue="1234"
        onValueChange={(_, eventDetails) => {
          eventDetails.cancel();
        }}
      />,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[1], { key: 'Backspace' });

    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('deletes the current character with Delete without moving focus', async () => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[1], { key: 'Delete' });

    expect(inputs.map((input) => input.value)).toEqual(['1', '3', '4', '', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
    expect(inputs[1].selectionStart).toBe(0);
    expect(inputs[1].selectionEnd).toBe(1);
  });

  it('selects the previous slot value after backspacing into the first slot', async () => {
    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[1].focus();
    await flushMicrotasks();

    await fireEvent.keyDown(inputs[1], { key: 'Backspace' });

    expect(document.activeElement).toBe(inputs[0]);
    expect(inputs[0].selectionStart).toBe(0);
    expect(inputs[0].selectionEnd).toBe(1);
  });

  it('keeps focus in place when paste is canceled', async () => {
    await render(
      <OTPFieldTest
        onValueChange={(_, eventDetails) => {
          eventDetails.cancel();
        }}
      />,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[0].focus();
    await flushMicrotasks();

    await pasteText(inputs[0], '1234');

    expect(inputs.map((input) => input.value)).toEqual(['', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('replaces values from the middle when pasting into a later slot', async () => {
    await render(<OTPFieldTest defaultValue="123456" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs[2].focus();
    await flushMicrotasks();

    await pasteText(inputs[2], '99');

    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '9', '9', '5', '6']);
    expect(document.activeElement).toBe(inputs[4]);
  });

  it('marks each input as complete when all slots are filled', async () => {
    await render(<OTPFieldTest defaultValue="123456" />);

    screen.getAllByRole<HTMLInputElement>('textbox').forEach((input) => {
      expect(input).toHaveAttribute('data-complete', '');
    });
  });

  it('adds disabled and readonly state attributes to each slot', async () => {
    const { rerender } = await render(<OTPFieldTest disabled />);

    screen.getAllByRole<HTMLInputElement>('textbox').forEach((input) => {
      expect(input).toHaveAttribute('data-disabled', '');
    });

    await rerender(<OTPFieldTest readOnly />);

    screen.getAllByRole<HTMLInputElement>('textbox').forEach((input) => {
      expect(input).toHaveAttribute('data-readonly', '');
    });
  });

  it('applies the Field label to every slot', async () => {
    await render(
      <Field.Root>
        <Field.Label data-testid="label">Verification code</Field.Label>
        <Field.Description data-testid="description">Enter the code.</Field.Description>
        <OTPFieldTest />
      </Field.Root>,
    );

    const label = screen.getByTestId('label');
    const description = screen.getByTestId('description');
    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs.forEach((input) => {
      expect(input).toHaveAttribute('aria-labelledby', label.id);
      expect(input).not.toHaveAttribute('aria-describedby', description.id);
    });
  });

  it('applies a native label to every slot', async () => {
    await render(
      <>
        <label for="verification-code">Verification code</label>
        <OTPField.Root id="verification-code" length={OTP_LENGTH}>
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
        </OTPField.Root>
      </>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs.forEach((input) => {
      expect(input).toHaveAccessibleName('Verification code');
    });
  });

  it('keeps the shared label on the first slot even if an aria-label is provided', async () => {
    await render(
      <>
        <label for="verification-code">Verification code</label>
        <OTPField.Root id="verification-code" length={OTP_LENGTH}>
          <OTPField.Input aria-label="Character 1 of 6" />
          <OTPField.Input aria-label="Character 2 of 6" />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
        </OTPField.Root>
      </>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    expect(inputs[0]).toHaveAccessibleName('Verification code');
    expect(inputs[0]).not.toHaveAttribute('aria-label', 'Character 1 of 6');
    expect(inputs[1]).toHaveAttribute('aria-label', 'Character 2 of 6');
  });

  it('warns when aria-label is provided on the first slot without an associated label', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <OTPField.Root length={OTP_LENGTH}>
          <OTPField.Input aria-label="Character 1 of 6" />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
        </OTPField.Root>,
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain(
        'Vase UI: <OTPField.Input> ignores `aria-label` on the first input.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not warn for a first-slot aria-label when a native label is associated', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <>
          <label for="verification-code">Verification code</label>
          <OTPField.Root id="verification-code" length={OTP_LENGTH}>
            <OTPField.Input aria-label="Character 1 of 6" />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
          </OTPField.Root>
        </>,
      );

      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not warn for a first-slot aria-label when Field.Label is associated', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <Field.Root>
          <Field.Label>Verification code</Field.Label>
          <OTPField.Root length={OTP_LENGTH}>
            <OTPField.Input aria-label="Character 1 of 6" />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
          </OTPField.Root>
        </Field.Root>,
      );

      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe('the text of a slot', () => {
    it.each([
      { name: 'an `input` event', types: ['input'] },
      { name: 'a `change` event', types: ['change'] },
      { name: 'an `input` and a `change` event', types: ['input', 'change'] },
    ] as const)(
      'takes a code that $name reports for the first slot one time',
      async ({ types }) => {
        const onValueChange = vi.fn();
        const onValueInvalid = vi.fn();
        const onValueComplete = vi.fn();

        await render(
          <OTPFieldTest
            onValueChange={onValueChange}
            onValueInvalid={onValueInvalid}
            onValueComplete={onValueComplete}
          />,
        );

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        inputs[0].focus();
        await flushMicrotasks();

        // A program that fills a form writes the text and sends `input`, `change` or both. No
        // microtask runs between the events.
        inputs[0].value = '12a34b56';
        for (const type of types) {
          inputs[0].dispatchEvent(new Event(type, { bubbles: true }));
        }
        await flushMicrotasks();

        expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange).toHaveBeenLastCalledWith('123456', expect.anything());
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('12a34b56');
        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(inputs[5]);
      },
    );

    it('writes no old character to the input when the parent takes the typed character', async () => {
      const value = shallowRef('');

      await render(() => (
        <OTPFieldTest
          value={value.value}
          onValueChange={(nextValue) => {
            value.value = nextValue;
          }}
        />
      ));

      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

      firstInput.focus();
      await flushMicrotasks();

      // The part and Vue write through the `value` property of the element. The helper of the
      // event writes through the property of the prototype, so it is not in the list.
      const writes: string[] = [];
      const { get, set } = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
      Object.defineProperty(firstInput, 'value', {
        configurable: true,
        get: () => get!.call(firstInput),
        set: (nextValue: string) => {
          writes.push(nextValue);
          set!.call(firstInput, nextValue);
        },
      });

      await fireEvent.input(firstInput, { target: { value: '1' } });
      await flushMicrotasks();

      expect(value.value).toBe('1');
      expect(writes).toEqual([]);
    });

    it('takes a `change` event for the character that the input had before a change of the parent', async () => {
      const value = shallowRef('1');
      const onValueChange = vi.fn();

      await render(() => <OTPFieldTest value={value.value} onValueChange={onValueChange} />);

      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

      firstInput.focus();
      await flushMicrotasks();

      // The user types the character that the slot has.
      await fireEvent.input(firstInput, { target: { value: '1' } });

      expect(onValueChange).not.toHaveBeenCalled();

      value.value = '';
      await flushMicrotasks();

      expect(firstInput.value).toBe('');

      // A program that fills a form writes the character and sends only `change`.
      firstInput.value = '1';
      firstInput.dispatchEvent(new Event('change', { bubbles: true }));
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenLastCalledWith('1', expect.anything());
    });

    it('takes a `change` event for the text that the input had before the end of a composition', async () => {
      const onValueChange = vi.fn((_: string, eventDetails: OTPField.Root.ChangeEventDetails) => {
        eventDetails.cancel();
      });

      await render(<OTPFieldTest onValueChange={onValueChange} />);

      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

      firstInput.focus();
      await flushMicrotasks();

      await fireEvent.compositionStart(firstInput);
      await fireEvent.input(firstInput, { target: { value: '1' } });
      await fireEvent.compositionEnd(firstInput, { target: { value: '1' } });

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(firstInput.value).toBe('');

      firstInput.value = '1';
      firstInput.dispatchEvent(new Event('change', { bubbles: true }));
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('the attributes of a slot', () => {
    it('turns autocorrect off', async () => {
      await render(<OTPFieldTest />);

      screen.getAllByRole('textbox').forEach((input) => {
        expect(input).toHaveAttribute('autocorrect', 'off');
      });
    });

    it.each([
      { name: 'the value `on`', value: 'on' },
      { name: 'the value `off`', value: 'off' },
    ])('has the `autocorrect` of the consumer: $name', async ({ value }) => {
      await render(
        <OTPField.Root length={1}>
          <OTPField.Input autocorrect={value} />
        </OTPField.Root>,
      );

      expect(screen.getByRole('textbox')).toHaveAttribute('autocorrect', value);
    });

    it('warns when the first slot gets an `aria-label` after the first render', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const label = shallowRef<string | undefined>(undefined);

      try {
        await render(() => (
          <OTPField.Root length={1}>
            <OTPField.Input aria-label={label.value} />
          </OTPField.Root>
        ));

        expect(warnSpy).not.toHaveBeenCalled();

        label.value = 'Character 1 of 1';
        await flushMicrotasks();

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0]?.[0]).toContain(
          'Vase UI: <OTPField.Input> ignores `aria-label` on the first input.',
        );
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  it('throws a descriptive error when rendered outside <OTPField.Root>', async () => {
    await expect(render(<OTPField.Input />)).rejects.toThrow(
      'Vase UI: A part of OTP Field must be inside <OTPField.Root>. Without a root the part has no value to show. Put the part inside <OTPField.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
