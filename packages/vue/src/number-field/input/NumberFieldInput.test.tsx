import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, shallowRef } from 'vue';
import type { CDPSession } from '@vitest/browser-playwright';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { NumberField } from '@vase-ui/vue/number-field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  mockRuntimeLocale,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import { platform } from '../../common/platform';
import { REASONS } from '../../internals/reasons';
import NumberFieldInputHydration from './NumberFieldInputHydration.test.vue';

const HYDRATION_FIXTURE = 'src/number-field/input/NumberFieldInputHydration.test.vue';

function getHiddenInput() {
  const hiddenInput = document.querySelector<HTMLInputElement>('input[aria-hidden][type=number]');
  if (!hiddenInput) {
    throw new Error('Expected a hidden number input.');
  }
  return hiddenInput;
}

describe('<NumberField.Input />', () => {
  const { render } = createRenderer();

  async function pasteWithError(target: HTMLElement, error: Error) {
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData() {
          throw error;
        },
      },
    });

    await fireEvent(target, pasteEvent);

    return pasteEvent;
  }

  describeConformance(<NumberField.Input />, () => ({
    refInstanceof: window.HTMLInputElement,
    render(node) {
      return render(<NumberField.Root>{node}</NumberField.Root>);
    },
  }));

  it('has textbox role', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );
    expect(screen.queryByRole('textbox')).not.toBe(null);
  });

  it('allows overriding the form provided by the root', async () => {
    await render(
      <>
        <form id="root-form" />
        <form id="input-form" data-testid="input-form" />
        <NumberField.Root form="root-form">
          <NumberField.Input form="input-form" />
        </NumberField.Root>
      </>,
    );

    expect(screen.getByRole<HTMLInputElement>('textbox').form).toBe(
      screen.getByTestId('input-form'),
    );
  });

  it('should not allow non-numeric characters on change', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.input(input, { target: { value: 'abc' } });
    expect(input).toHaveValue('');
  });

  it('should not allow non-numeric characters on keydown', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.keyDown(input, { key: 'a' });
    expect(input).toHaveValue('');
  });

  it('should allow numeric characters on change', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.input(input, { target: { value: '123' } });
    expect(input).toHaveValue('123');
  });

  it('should increment on keydown ArrowUp', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('1');
  });

  it('should decrement on keydown ArrowDown', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('-1');
  });

  it('should set the value to min on keydown Home', async () => {
    await render(
      <NumberField.Root min={-10} max={10}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.keyDown(input, { key: 'Home' });
    expect(input).toHaveValue('-10');
  });

  it('should set the value to max on keydown End', async () => {
    await render(
      <NumberField.Root min={-10} max={10}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.keyDown(input, { key: 'End' });
    expect(input).toHaveValue('10');
  });

  it('uses smallStep and snapOnStep when holding Alt with ArrowUp/ArrowDown', async () => {
    await render(
      <NumberField.Root defaultValue={0.15} smallStep={0.1} snapOnStep>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.keyDown(input, { key: 'ArrowUp', altKey: true });
    expect(input).toHaveValue(new Intl.NumberFormat().format(0.3));
    await fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
    expect(input).toHaveValue(new Intl.NumberFormat().format(0.2));
  });

  it('advances by a smallStep finer than 3 fraction digits', async () => {
    const onValueChange = vi.fn();

    const Controlled = defineComponent(() => {
      const value = shallowRef<number | null>(0);
      return () => (
        <NumberField.Root
          value={value.value}
          smallStep={0.0001}
          onValueChange={(val) => {
            onValueChange(val);
            value.value = val;
          }}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    });

    await render(<Controlled />);

    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();

    await fireEvent.keyDown(input, { key: 'ArrowUp', altKey: true });

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0001);
    expect(input).toHaveValue('0');
  });

  it('increments with keyboard from numeric state, not rounded display text', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root defaultValue={1.23456} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();
    await flushMicrotasks();

    // Synced display shows the rounded `1.235`; stepping must advance the full-precision
    // numeric value (matching the button path), not the parsed display string.
    await fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(onValueChange.mock.lastCall?.[0]).toBe(2.23456);
  });

  it('decrements with keyboard from numeric state, not rounded display text', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root defaultValue={1.23456} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();
    await flushMicrotasks();

    // ArrowDown must step from the full-precision numeric value (0.23456), not the rounded
    // display (which would yield 0.235).
    await fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.23456);
  });

  it('increments with keyboard from numeric state after a no-edit blur cycle', async () => {
    const onValueChange = vi.fn();

    const Controlled = defineComponent(() => {
      const value = shallowRef<number | null>(null);
      return () => (
        <NumberField.Root
          value={value.value}
          onValueChange={(val) => {
            onValueChange(val);
            value.value = val;
          }}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    });

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');

    input.focus();
    await flushMicrotasks();
    await user.keyboard('1.23456');
    await fireEvent.focusOut(input);
    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();
    await flushMicrotasks();
    await fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(onValueChange.mock.lastCall?.[0]).toBe(2.23456);
  });

  it('steps keyboard from dirty input text when the controlled value lags onValueChange', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();

    // The parent intentionally never mirrors `onValueChange` back into `value`, so the numeric
    // state stays 0 while the visible text is dirty.
    await fireEvent.input(input, { target: { value: '1.5' } });
    expect(onValueChange.mock.lastCall?.[0]).toBe(1.5);

    // ArrowUp must step from the dirty text (1.5 -> 2.5), not the stale numeric state (0 -> 1).
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onValueChange.mock.lastCall?.[0]).toBe(2.5);
  });

  it('does not commit a stale value when a synced keyboard step is canceled after an external change', async () => {
    const onValueCommitted = vi.fn();
    let cancelNextChange = false;

    const Controlled = defineComponent(() => {
      const value = shallowRef<number | null>(0);
      return () => (
        <NumberField.Root
          value={value.value}
          onValueChange={(val, details) => {
            if (cancelNextChange) {
              details.cancel();
              return;
            }
            value.value = val;
          }}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
          <button
            onClick={() => {
              value.value = 10;
            }}
          >
            external
          </button>
        </NumberField.Root>
      );
    });

    await render(<Controlled />);
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();

    // A prior committed keyboard step populates the internal `lastChangedValueRef` (1).
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onValueCommitted.mock.calls.length).toBe(1);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);

    // The controlled value changes externally to 10.
    await fireEvent.click(screen.getByText('external'));

    // Canceling the next keyboard step must not commit the stale earlier value (1): the synced
    // path now refreshes the commit ref to the current value before stepping.
    cancelNextChange = true;
    await fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(onValueCommitted.mock.calls.length).toBe(1);
  });

  it('keeps dirty-input authority after a non-mutating key so the next keyboard step uses dirty text', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();

    // Dirty text the parent never mirrors back into `value` (still 0).
    await fireEvent.input(input, { target: { value: '1.5' } });

    // A non-mutating navigation key must not mark the input as synced.
    await fireEvent.keyDown(input, { key: 'ArrowLeft' });

    // ArrowUp must still step from the dirty text (1.5 -> 2.5), not the stale numeric state.
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onValueChange.mock.lastCall?.[0]).toBe(2.5);
  });

  it('commits dirty text on blur after a cursor key when the controlled value does not mirror it', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();

    // Parent never mirrors onValueChange, so the numeric state stays 0 while the text is dirty.
    await fireEvent.input(input, { target: { value: '5' } });
    expect(onValueChange.mock.lastCall?.[0]).toBe(5);

    // A cursor key must not clear dirty authority, so blur commits the typed text (5) rather
    // than silently reverting to the stale numeric state (0).
    await fireEvent.keyDown(input, { key: 'ArrowLeft' });
    onValueChange.mockClear();
    await fireEvent.focusOut(input);
    expect(onValueChange.mock.lastCall?.[0]).toBe(5);
  });

  it('allows unicode plus/minus, permille and fullwidth digits on keydown when formatted as percent', async () => {
    await render(
      <NumberField.Root format={{ style: 'percent' }}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();

    function dispatchKey(key: string) {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    }

    expect(dispatchKey('−')).toBe(true); // MINUS SIGN U+2212
    expect(dispatchKey('＋')).toBe(true); // FULLWIDTH PLUS SIGN U+FF0B
    expect(dispatchKey('‰')).toBe(true);
    expect(dispatchKey('１')).toBe(true);
  });

  it('blocks percent and permille symbols on keydown when not formatted as percent', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();

    function dispatchKey(key: string) {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    }

    expect(dispatchKey('%')).toBe(false);
    expect(dispatchKey('‰')).toBe(false);
  });

  it.each([
    {
      name: 'accounting with negatives',
      currencySign: 'accounting',
      min: -10,
      outOfRange: false,
      allowed: true,
    },
    {
      name: 'accounting with out-of-range entry',
      currencySign: 'accounting',
      min: 0,
      outOfRange: true,
      allowed: true,
    },
    {
      name: 'accounting without negatives',
      currencySign: 'accounting',
      min: 0,
      outOfRange: false,
      allowed: false,
    },
    {
      name: 'standard currency sign',
      currencySign: 'standard',
      min: -10,
      outOfRange: false,
      allowed: false,
    },
  ] as const)(
    'allows parentheses on keydown only for accounting formats that accept negatives ($name)',
    async ({ currencySign, min, outOfRange, allowed }) => {
      await render(
        <NumberField.Root
          min={min}
          allowOutOfRange={outOfRange}
          format={{ style: 'currency', currency: 'USD', currencySign }}
        >
          <NumberField.Input />
        </NumberField.Root>,
      );

      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      function dispatchKey(key: string) {
        const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        return input.dispatchEvent(evt);
      }

      expect(dispatchKey('(')).toBe(allowed);
      expect(dispatchKey(')')).toBe(allowed);
    },
  );

  it('accepts a typed negative exponent when negatives are not allowed', async () => {
    const format = { notation: 'scientific' } as const;
    const formatter = new Intl.NumberFormat('en-US', format);
    const onValueCommitted = vi.fn();

    const { user } = await render(
      <NumberField.Root
        locale="en-US"
        format={format}
        min={0}
        defaultValue={1500}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.focus();
    await flushMicrotasks();
    expect(input).toHaveValue(formatter.format(1500));

    // Replace the exponent of `1.5E3`
    input.setSelectionRange(input.value.length - 1, input.value.length);
    await user.keyboard('-3');
    await fireEvent.focusOut(input);

    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0015);
    expect(input).toHaveValue(formatter.format(0.0015));
  });

  it('applies locale-aware decimal/group gating (de-DE)', async () => {
    await render(
      <NumberField.Root locale="de-DE">
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();

    const dispatchKey = (key: string) => {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    };

    // de-DE: decimal is ',' and group is '.'
    // First comma is allowed
    expect(dispatchKey(',')).toBe(true);
    // Simulate a typical user value with a digit before decimal to let change handler accept it
    await fireEvent.input(input, { target: { value: '1,' } });
    expect(input).toHaveValue('1,');

    // Second comma should be blocked
    expect(dispatchKey(',')).toBe(false);

    // Grouping '.' should be allowed multiple times
    expect(dispatchKey('.')).toBe(true);
    await fireEvent.input(input, { target: { value: '1.,' } });
    expect(dispatchKey('.')).toBe(true);
  });

  it('allows space key when locale uses space-like grouping (pl-PL)', async () => {
    await render(
      <NumberField.Root locale="pl-PL">
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();

    const dispatchKey = (key: string) => {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    };

    // pl-PL grouping is a space-like character; typing plain space from keyboard should be allowed
    expect(dispatchKey(' ')).toBe(true);

    // Simulate a typical user value using a regular space as group
    await fireEvent.input(input, { target: { value: '1 234' } });
    expect(input).toHaveValue('1 234');
  });

  it('commits formatted value only on blur', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.input(input, { target: { value: '1234' } });
    expect(input).toHaveValue('1234');
    await fireEvent.focusOut(input);
    expect(input).toHaveValue((1234).toLocaleString());
  });

  it('should commit validated number on blur (min)', async () => {
    await render(
      <NumberField.Root min={0}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.input(input, { target: { value: '-1' } });
    expect(input).toHaveValue('-1');
    await fireEvent.focusOut(input);
    expect(input).toHaveValue('0');
  });

  it('should commit validated number on blur (max)', async () => {
    await render(
      <NumberField.Root max={0}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.input(input, { target: { value: '1' } });
    expect(input).toHaveValue('1');
    await fireEvent.focusOut(input);
    expect(input).toHaveValue('0');
  });

  it('should not snap number to step on blur', async () => {
    await render(
      <NumberField.Root step={0.5} snapOnStep>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    // 1.3 is off the 0.5 step grid, so any snapping on blur would change it.
    await fireEvent.input(input, { target: { value: '1.3' } });
    expect(input).toHaveValue('1.3');
    await fireEvent.focusOut(input);
    expect(input).toHaveValue((1.3).toLocaleString());
  });

  it('should commit validated number on blur (step and min)', async () => {
    await render(
      <NumberField.Root min={2} step={2}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.input(input, { target: { value: '3' } });
    expect(input).toHaveValue('3');
    await fireEvent.focusOut(input);
    expect(input).toHaveValue('3');
  });

  it('should preserve default formatting on first blur after external value change', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await setProps({ value: 1.23456 });

    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();
    input.blur();
    await flushMicrotasks();

    // A focus/blur with no edits must not re-parse the rounded display text and overwrite the
    // numeric value: the display is purely visual formatting.
    expect(input).toHaveValue((1.23456).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(0);
  });

  it('should allow typing after default formatting on blur', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps, user } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await setProps({ value: 1.23456 });

    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();
    input.blur();
    await flushMicrotasks();

    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();
    await flushMicrotasks();

    await user.clear(input);
    await user.keyboard('1.234567');
    expect(input).toHaveValue('1.234567');

    await fireEvent.focusOut(input);
    expect(input).toHaveValue((1.234567).toLocaleString());
  });

  it('should format to default canonical representation on blur', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps, user } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await setProps({ value: 1.23456 });

    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();
    await flushMicrotasks();

    await user.clear(input);
    await user.keyboard('1.23456000');
    expect(input).toHaveValue('1.23456000');

    await fireEvent.focusOut(input);
    expect(input).toHaveValue((1.23456).toLocaleString());
  });

  it('should handle multiple blur cycles with default formatting', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await setProps({ value: 1.23456789 });

    expect(input).toHaveValue((1.23456789).toLocaleString());

    input.focus();
    input.blur();
    await flushMicrotasks();

    expect(input).toHaveValue((1.23456789).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(0);

    input.focus();
    input.blur();
    await flushMicrotasks();

    // Repeated no-edit blur cycles keep the full-precision numeric value; only the display
    // stays formatted to the Intl default.
    expect(input).toHaveValue((1.23456789).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(0);
  });

  it('should handle edge case where parsed value equals current value but input differs', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps, user } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await setProps({ value: 1.5 });

    expect(input).toHaveValue((1.5).toLocaleString());

    input.focus();
    await flushMicrotasks();

    await user.clear(input);
    await user.keyboard('1.50');
    expect(input).toHaveValue('1.50');

    await fireEvent.focusOut(input);
    expect((input as HTMLInputElement).value).toMatch(/^1[.,]5/);
  });

  it('should apply default formatting after external change during typing', async () => {
    const onValueChange = vi.fn();

    const Controlled = defineComponent(() => {
      const value = shallowRef<number | null>(null);
      return () => (
        <NumberField.Root
          value={value.value}
          onValueChange={(val) => {
            onValueChange(val);
            value.value = val;
          }}
        >
          <NumberField.Input />
          <button
            onClick={() => {
              value.value = 3.14159265;
            }}
          >
            set pi
          </button>
        </NumberField.Root>
      );
    });

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');

    input.focus();
    await flushMicrotasks();

    await user.keyboard('2.7');
    expect(input).toHaveValue('2.7');

    await user.click(screen.getByText('set pi'));

    expect(input).toHaveValue((3.14159265).toLocaleString());

    await fireEvent.focusOut(input);
    expect(input).toHaveValue((3.14159265).toLocaleString());
  });

  it('should round to explicit maximumFractionDigits on blur', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root
          value={props.value}
          onValueChange={onValueChange}
          format={{ maximumFractionDigits: 2 }}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await setProps({ value: 1.23456 });

    expect(input).toHaveValue((1.23).toLocaleString());

    input.focus();
    input.blur();
    await flushMicrotasks();

    expect(input).toHaveValue((1.23).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(1);
    expect(onValueChange.mock.calls[0][0]).toBe(1.23);
  });

  async function renderControlledNumberField(
    format: Intl.NumberFormatOptions,
    locale: Intl.LocalesArgument = 'en-US',
    rootProps: { min?: number; max?: number; allowOutOfRange?: boolean } = {},
  ) {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    const Controlled = defineComponent(() => {
      const value = shallowRef<number | null>(null);
      return () => (
        <NumberField.Root
          value={value.value}
          onValueChange={(nextValue) => {
            onValueChange(nextValue);
            value.value = nextValue;
          }}
          onValueCommitted={onValueCommitted}
          format={format}
          locale={locale}
          {...rootProps}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    });

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');

    input.focus();
    await flushMicrotasks();

    return { input, onValueChange, onValueCommitted, user };
  }

  it.each([
    ['en-US', '1.239'],
    ['fr-FR', '1,239'],
    ['ar-EG', '١٫٢٣٩'],
  ] as const)(
    'should respect roundingMode when rounding to explicit maximumFractionDigits on blur in %s',
    async (locale, inputText) => {
      const format = {
        maximumFractionDigits: 2,
        roundingMode: 'floor',
      };

      const { input, onValueChange, user } = await renderControlledNumberField(format, locale);

      await user.keyboard(inputText);
      await fireEvent.focusOut(input);

      expect(onValueChange.mock.lastCall?.[0]).toBe(1.23);
      expect(input).toHaveValue(new Intl.NumberFormat(locale, format).format(1.239));
    },
  );

  it('should not throw on blur when format uses roundingIncrement with fixed fraction digits', async () => {
    const format = {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      roundingIncrement: 5,
    };

    await render(
      <NumberField.Root defaultValue={1.2} format={format}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    const expectedValue = new Intl.NumberFormat(undefined, format).format(1.2);

    expect(input).toHaveValue(expectedValue);

    input.focus();
    input.blur();
    await flushMicrotasks();

    expect(input).toHaveValue(expectedValue);
  });

  it('should commit roundingIncrement values on blur', async () => {
    const format = {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      roundingIncrement: 5,
    };

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('1.26');
    expect(onValueCommitted).not.toHaveBeenCalled();

    await fireEvent.focusOut(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(1.5);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.5);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1.26));
  });

  it('should commit significant digit rounded values on blur', async () => {
    const format = {
      maximumSignificantDigits: 3,
      roundingMode: 'floor',
    };

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('12345');
    await fireEvent.focusOut(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(12300);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(12300);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(12345));
  });

  it('should preserve tiny percent significant digit rounded values on blur', async () => {
    const format = {
      style: 'percent',
      maximumSignificantDigits: 2,
    } as const;

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('0.0001234%');
    await fireEvent.focusOut(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0000012);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0000012);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(0.000001234));
  });

  it('should commit roundingMode values on blur without explicit precision', async () => {
    const format = {
      minimumIntegerDigits: 1,
      roundingMode: 'floor',
    };

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('1.2399');
    await fireEvent.focusOut(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(1.239);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.239);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1.2399));
  });

  it('should format controlled values with rounding options after external value changes', async () => {
    const format = {
      minimumIntegerDigits: 1,
      roundingMode: 'floor',
    };

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} format={format}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await setProps({ value: 1.2399 });

    expect(input).toHaveValue(new Intl.NumberFormat(undefined, format).format(1.2399));
  });

  it.each([
    [
      'percent',
      {
        style: 'percent',
        maximumFractionDigits: 2,
        roundingMode: 'floor',
      },
      0.0123,
    ],
    [
      'percent with min-only precision',
      {
        style: 'percent',
        minimumFractionDigits: 2,
        roundingMode: 'floor',
      },
      0.0123,
    ],
    [
      'unit percent',
      {
        style: 'unit',
        unit: 'percent',
        maximumFractionDigits: 2,
        roundingMode: 'floor',
      },
      1.23,
    ],
  ] as const)('should round %s values on blur', async (_, format, expectedValue) => {
    const { input, onValueChange, user } = await renderControlledNumberField(format);

    await user.keyboard('1.239%');
    await fireEvent.focusOut(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(expectedValue);
    expect(input).toHaveValue('1.23%');
  });

  it('should parse locale prefix percent values on blur', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
    } as const;
    const formatted = new Intl.NumberFormat('tr-TR', format).format(0.0123);

    const { input, onValueChange, onValueCommitted } = await renderControlledNumberField(
      format,
      'tr-TR',
    );

    await fireEvent.input(input, { target: { value: formatted } });
    await fireEvent.focusOut(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0123);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0123);
    expect(input).toHaveValue(formatted);
  });

  it('should preserve exact percent precision boundaries with directional roundingMode on blur', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
      roundingMode: 'floor',
    } as const;

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('0.46%');
    await fireEvent.focusOut(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0046);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0046);
    expect(input).toHaveValue('0.46%');
  });

  it('should preserve high-precision percent boundaries with directional roundingMode on blur', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 16,
      roundingMode: 'floor',
    } as const;

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('0.46%');
    await fireEvent.focusOut(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0046);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0046);
    expect(input).toHaveValue('0.46%');
  });

  it('should commit the clamped value when blur rounding crosses a boundary', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
    } as const;

    const { input, onValueChange, onValueCommitted, user } = await renderControlledNumberField(
      format,
      'en-US',
      { max: 0.01235 },
    );

    await user.keyboard('1.236%');
    await fireEvent.focusOut(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.01235);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.01235);
  });

  it('should round currency values on blur without percent scaling', async () => {
    const format = {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      roundingMode: 'floor',
    } as const;

    const { input, onValueChange, user } = await renderControlledNumberField(format);

    await user.keyboard('1.239');
    await fireEvent.focusOut(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(1.23);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1.239));
  });

  it('should not commit values that overflow while parsing on blur', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
      roundingMode: 'floor',
    } as const;
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    await render(
      <NumberField.Root
        format={format}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    const formattedOverflow = new Intl.NumberFormat(undefined, format).format(Number.MAX_VALUE);

    input.focus();
    await flushMicrotasks();
    await fireEvent.input(input, { target: { value: formattedOverflow } });
    await fireEvent.focusOut(input);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommitted).not.toHaveBeenCalled();
    expect(input).toHaveValue(formattedOverflow);
  });

  it('should not commit a canceled blur change', async () => {
    const onValueChange = vi.fn((_nextValue, details) => {
      details.cancel();
    });
    const onValueCommitted = vi.fn();

    await render(
      <NumberField.Root
        value={0}
        format={{ maximumFractionDigits: 2 }}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');

    input.focus();
    await flushMicrotasks();
    await fireEvent.input(input, { target: { value: '1.239' } });
    await fireEvent.focusOut(input);

    expect(onValueCommitted).not.toHaveBeenCalled();
    expect(input).toHaveValue('1.239');
  });

  it('should preserve default numeric precision while formatting display on blur', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    const Controlled = defineComponent(() => {
      const value = shallowRef<number | null>(null);
      return () => (
        <NumberField.Root
          value={value.value}
          onValueChange={(val) => {
            onValueChange(val);
            value.value = val;
          }}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    });

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');

    input.focus();
    await flushMicrotasks();

    await user.keyboard('1.23456');
    expect(input).toHaveValue('1.23456');

    // Without explicit rounding options the numeric value keeps full precision rather than
    // being truncated to the Intl display default of 3 fraction digits.
    expect(onValueChange.mock.lastCall?.[0]).toBe(1.23456);

    await fireEvent.focusOut(input);

    // The committed value retains full precision, while the displayed text uses default formatting.
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.23456);
    expect(input).toHaveValue((1.23456).toLocaleString());
  });

  it('should preserve values typed with more than 15 significant digits', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    const Controlled = defineComponent(() => {
      const value = shallowRef<number | null>(null);
      return () => (
        <NumberField.Root
          value={value.value}
          onValueChange={(val) => {
            onValueChange(val);
            value.value = val;
          }}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    });

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');

    input.focus();
    await flushMicrotasks();

    // Parsed input gets no rounding or cleanup beyond standard JS number parsing, so every
    // digit the resulting `number` can represent is preserved (here all 16 typed digits).
    await user.keyboard('1.234567890123456');
    expect(input).toHaveValue('1.234567890123456');
    expect(onValueChange.mock.lastCall?.[0]).toBe(1.234567890123456);

    await fireEvent.focusOut(input);

    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.234567890123456);
    expect(input).toHaveValue((1.234567890123456).toLocaleString());
  });

  it('commits parsed value on blur and normalizes display for fr-FR', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root locale="fr-FR" onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.focus();
    await flushMicrotasks();

    await fireEvent.input(input, { target: { value: '1234,5' } });
    expect(input).toHaveValue('1234,5');

    await fireEvent.focusOut(input);

    expect(onValueChange.mock.calls.length).toBe(1);
    expect(onValueChange.mock.calls[0][0]).toBe(1234.5);

    expect(input.value).toBe((1234.5).toLocaleString('fr-FR'));
  });

  it('commits an edited negative pt-BR currency value on blur', async () => {
    const format = { style: 'currency', currency: 'BRL' } as const;
    const formatter = new Intl.NumberFormat('pt-BR', format);
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    const { user } = await render(
      <NumberField.Root
        name="price"
        locale="pt-BR"
        format={format}
        defaultValue={-13}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.focus();
    await flushMicrotasks();
    expect(input).toHaveValue(formatter.format(-13));

    // Replace the `3` in `-R$ 13,00`.
    const digitIndex = input.value.indexOf('13') + 1;
    input.setSelectionRange(digitIndex, digitIndex + 1);
    await user.keyboard('4');
    expect(input).toHaveValue(formatter.format(-14));
    expect(onValueChange.mock.lastCall?.[0]).toBe(-14);

    await fireEvent.focusOut(input);

    expect(onValueCommitted.mock.lastCall?.[0]).toBe(-14);
    expect(input).toHaveValue(formatter.format(-14));
    expect(document.querySelector<HTMLInputElement>('input[name="price"]')).toHaveValue(-14);

    input.focus();
    await flushMicrotasks();
    await user.keyboard('{ArrowUp}');

    expect(onValueChange.mock.lastCall?.[0]).toBe(-13);
  });

  it('commits an edited value whose unit label contains a period (pl-PL)', async () => {
    const format = { style: 'unit', unit: 'celsius' } as const;
    const formatter = new Intl.NumberFormat('pl-PL', format);
    const onValueCommitted = vi.fn();

    const { user } = await render(
      <NumberField.Root
        locale="pl-PL"
        format={format}
        defaultValue={21.5}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.focus();
    await flushMicrotasks();
    expect(input).toHaveValue(formatter.format(21.5));

    // Replace the fraction digit in `21,5 st. C`.
    const digitIndex = input.value.indexOf('5');
    input.setSelectionRange(digitIndex, digitIndex + 1);
    await user.keyboard('7');
    await fireEvent.focusOut(input);

    expect(onValueCommitted.mock.lastCall?.[0]).toBe(21.7);
    expect(input).toHaveValue(formatter.format(21.7));
  });

  it.each([
    // Pinned because WebKit formats bn-BD with Latin digits
    { name: 'locale tag (bn-BD)', locale: 'bn-BD-u-nu-beng', format: undefined },
    { name: 'numberingSystem option', locale: 'en-US', format: { numberingSystem: 'deva' } },
  ])('accepts typed digits of the numbering system ($name)', async ({ locale, format }) => {
    const formatter = new Intl.NumberFormat(locale, format);
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    const { user } = await render(
      <NumberField.Root
        locale={locale}
        format={format}
        defaultValue={12}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.focus();
    await flushMicrotasks();
    expect(input).toHaveValue(formatter.format(12));

    input.setSelectionRange(input.value.length, input.value.length);
    await user.keyboard(formatter.format(3));

    expect(input).toHaveValue(formatter.format(123));
    expect(onValueChange.mock.lastCall?.[0]).toBe(123);

    await fireEvent.focusOut(input);

    expect(onValueCommitted.mock.lastCall?.[0]).toBe(123);
  });

  it.each([
    {
      name: 'fraction digits',
      format: { notation: 'compact', maximumFractionDigits: 1 },
      committed: [],
    },
    {
      name: 'significant digits',
      format: { notation: 'compact', maximumSignificantDigits: 2 },
      committed: [1200],
    },
  ] as const)(
    'rounds the stored value, not the compact text, on blur ($name)',
    async ({ format, committed }) => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();

      await render(
        <NumberField.Root
          locale="en-US"
          format={format}
          defaultValue={1234}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
        </NumberField.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');
      input.focus();
      await flushMicrotasks();
      expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1234));

      await fireEvent.focusOut(input);

      // `1.2K` is never read back as 1.2: one fraction digit keeps 1234, two significant digits
      // round it to 1200
      expect(onValueChange.mock.calls.map(([value]) => value)).toEqual(committed);
      expect(onValueCommitted.mock.calls.map(([value]) => value)).toEqual(committed);
    },
  );

  it('commits an edited grouped compact value (de-DE)', async () => {
    const format = { notation: 'compact' } as const;
    const formatter = new Intl.NumberFormat('de-DE', format);
    const onValueCommitted = vi.fn();

    const { user } = await render(
      <NumberField.Root
        locale="de-DE"
        format={format}
        defaultValue={10000}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.focus();
    await flushMicrotasks();
    expect(input).toHaveValue(formatter.format(10000));

    // Replace the last digit of `10.000`
    input.setSelectionRange(input.value.length - 1, input.value.length);
    await user.keyboard('1');
    await fireEvent.focusOut(input);

    expect(onValueCommitted.mock.lastCall?.[0]).toBe(10001);
    expect(input).toHaveValue(formatter.format(10001));
  });

  it('keeps the stored value on blur after a rejected edit to compact text', async () => {
    const format = { notation: 'compact' } as const;
    const onValueChange = vi.fn();

    const { user } = await render(
      <NumberField.Root
        name="count"
        locale="en-US"
        format={format}
        defaultValue={1234}
        onValueChange={onValueChange}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.focus();
    await flushMicrotasks();
    input.setSelectionRange(input.value.length, input.value.length);

    // `1.2K5` is rejected because the compact suffix can't be typed
    await user.keyboard('5');
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1234));

    await fireEvent.focusOut(input);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>('input[name="count"]')).toHaveValue(1234);
  });

  it.each([
    {
      name: 'en-US foot',
      locale: 'en-US',
      format: { style: 'unit', unit: 'foot', unitDisplay: 'long' },
      value: 1,
      edited: 12,
    },
    {
      name: 'ru-RU day',
      locale: 'ru-RU',
      format: { style: 'unit', unit: 'day', unitDisplay: 'long' },
      value: 1,
      edited: 12,
    },
    {
      name: 'ga acre',
      locale: 'ga',
      format: { style: 'unit', unit: 'acre', unitDisplay: 'long' },
      value: 7,
      edited: 72,
    },
    {
      name: 'bs EUR',
      locale: 'bs',
      format: { style: 'currency', currency: 'EUR', currencyDisplay: 'name' },
      value: 1.01,
      edited: 12.01,
    },
    {
      name: 'bs GBP',
      locale: 'bs',
      format: { style: 'currency', currency: 'GBP', currencyDisplay: 'name' },
      value: 0.02,
      edited: 2.02,
    },
    {
      name: 'fil USD',
      locale: 'fil',
      format: { style: 'currency', currency: 'USD', currencyDisplay: 'name' },
      value: 1.49,
      edited: 12.49,
    },
    {
      name: 'cy foot',
      locale: 'cy',
      format: { style: 'unit', unit: 'foot', unitDisplay: 'long' },
      value: 6,
      edited: 62,
    },
    {
      name: 'cy millisecond',
      locale: 'cy',
      format: { style: 'unit', unit: 'millisecond' },
      value: 0,
      edited: 2,
    },
    {
      name: 'br foot',
      locale: 'br',
      format: { style: 'unit', unit: 'foot', unitDisplay: 'long' },
      value: 3,
      edited: 32,
    },
    {
      name: 'br acre',
      locale: 'br',
      format: { style: 'unit', unit: 'acre', unitDisplay: 'long' },
      value: 1e6,
      edited: 12000000,
    },
    {
      name: 'mt megabyte',
      locale: 'mt',
      format: { style: 'unit', unit: 'megabyte', unitDisplay: 'long' },
      value: 11,
      edited: 121,
    },
    {
      name: 'sl day',
      locale: 'sl',
      format: { style: 'unit', unit: 'day', unitDisplay: 'long' },
      value: 2,
      edited: 22,
    },
  ] as const)(
    'accepts edits to a label that changes with the plural form ($name)',
    async ({ locale, format, value, edited }) => {
      // Labels such as `1 foot`, `1 день`, `7 n-acra` and `1,01 euro` have letters the other plural
      // forms lack. Each value is the only one of the formatter's plural samples that renders some
      // letter of its label.
      const formatter = new Intl.NumberFormat(locale, format);
      const onValueChange = vi.fn();

      const { user } = await render(
        <NumberField.Root
          locale={locale}
          format={format}
          defaultValue={value}
          onValueChange={onValueChange}
        >
          <NumberField.Input />
        </NumberField.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');
      input.focus();
      await flushMicrotasks();
      expect(input).toHaveValue(formatter.format(value));

      // Insert a `2` after the first digit
      input.setSelectionRange(1, 1);
      await user.keyboard('2');
      expect(onValueChange.mock.lastCall?.[0]).toBe(edited);

      await fireEvent.focusOut(input);

      expect(input).toHaveValue(formatter.format(edited));
    },
  );

  it('does not report a change when blurring a NaN value', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    await render(
      <NumberField.Root
        value={NaN}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();
    await fireEvent.focusOut(input);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommitted).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'with a value', defaultValue: 5, expected: new Intl.NumberFormat().format(5) },
    { name: 'when empty', defaultValue: undefined, expected: '' },
  ])(
    'reformats text left unparsed by an earlier blur on the next blur ($name)',
    async ({ defaultValue, expected }) => {
      const onValueChange = vi.fn();

      await render(
        <NumberField.Root defaultValue={defaultValue} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');
      input.focus();
      await flushMicrotasks();
      await fireEvent.input(input, { target: { value: '-' } });
      await fireEvent.focusOut(input);
      expect(input).toHaveValue('-');

      input.focus();
      await flushMicrotasks();
      await fireEvent.focusOut(input);

      expect(input).toHaveValue(expected);
      expect(onValueChange).not.toHaveBeenCalled();
    },
  );

  it('commits an edited accounting negative on blur', async () => {
    const format = { style: 'currency', currency: 'USD', currencySign: 'accounting' } as const;
    const formatter = new Intl.NumberFormat('en-US', format);
    const onValueCommitted = vi.fn();

    const { user } = await render(
      <NumberField.Root
        locale="en-US"
        format={format}
        defaultValue={-13}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.focus();
    await flushMicrotasks();
    expect(input).toHaveValue(formatter.format(-13));

    // Replace the `3` in `($13.00)`.
    const digitIndex = input.value.indexOf('13') + 1;
    input.setSelectionRange(digitIndex, digitIndex + 1);
    await user.keyboard('4');
    expect(input).toHaveValue(formatter.format(-14));

    await fireEvent.focusOut(input);

    expect(onValueCommitted.mock.lastCall?.[0]).toBe(-14);
    expect(input).toHaveValue(formatter.format(-14));
  });

  it('reads an accounting negative as negative after its closing parenthesis is deleted', async () => {
    const format = { style: 'currency', currency: 'USD', currencySign: 'accounting' } as const;
    const formatter = new Intl.NumberFormat('en-US', format);
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    const { user } = await render(
      <NumberField.Root
        locale="en-US"
        format={format}
        defaultValue={-1234.5}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    input.focus();
    await flushMicrotasks();
    expect(input).toHaveValue(formatter.format(-1234.5));

    // Backspace over the `)` and the last `0` of `($1,234.50)`, then type `7`
    input.setSelectionRange(input.value.length, input.value.length);
    await user.keyboard('{Backspace}{Backspace}7');
    expect(input).toHaveValue(formatter.format(-1234.57).slice(0, -1));
    expect(onValueChange.mock.lastCall?.[0]).toBe(-1234.57);

    await fireEvent.focusOut(input);

    expect(onValueCommitted.mock.lastCall?.[0]).toBe(-1234.57);
    expect(input).toHaveValue(formatter.format(-1234.57));
  });

  it('warns in development when clipboard text cannot be read during paste handling', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <NumberField.Root defaultValue={12}>
          <NumberField.Input />
        </NumberField.Root>,
      );

      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      const pasteEvent = await pasteWithError(input, new DOMException('Blocked', 'SecurityError'));

      expect(input).toHaveValue('12');
      expect(pasteEvent.defaultPrevented).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain(
        'Vase UI: <NumberField.Input> could not read clipboard text during paste handling.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('reports an unchanged value once when a paste event carries no clipboard data', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root defaultValue={12} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    input.focus();
    await flushMicrotasks();

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', { value: null });
    await fireEvent(input, pasteEvent);

    // Missing clipboard text splices an empty string in, so the text is unchanged. The paste
    // still marks the input dirty, and direct-entry reasons report even when the number is
    // unchanged, so exactly one `input-paste` change is emitted with the current value.
    expect(input).toHaveValue('12');
    expect(onValueChange.mock.calls.length).toBe(1);
    expect(onValueChange.mock.calls[0][0]).toBe(12);
    expect(onValueChange.mock.calls[0][1].reason).toBe(REASONS.inputPaste);
  });

  describe('single sign character', () => {
    async function renderSigned() {
      await render(
        <NumberField.Root min={-10} max={10} defaultValue={-5}>
          <NumberField.Input />
        </NumberField.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');
      input.focus();
      await flushMicrotasks();
      expect(input).toHaveValue('-5');

      return {
        input,
        pressMinus() {
          return input.dispatchEvent(
            new window.KeyboardEvent('keydown', { key: '-', bubbles: true, cancelable: true }),
          );
        },
      };
    }

    it('blocks a second minus sign when the existing one is not selected', async () => {
      const { input, pressMinus } = await renderSigned();
      input.setSelectionRange(2, 2);
      expect(pressMinus()).toBe(false);
    });

    it('allows a minus sign that replaces the selected existing sign', async () => {
      const { input, pressMinus } = await renderSigned();
      input.setSelectionRange(0, 1);
      expect(pressMinus()).toBe(true);
    });

    it('allows a minus sign when the whole value is selected', async () => {
      const { input, pressMinus } = await renderSigned();
      input.setSelectionRange(0, input.value.length);
      expect(pressMinus()).toBe(true);
    });
  });

  describe('focus selection', () => {
    it('keeps the selection the browser set when focus moves into the input', async () => {
      await render(
        <NumberField.Root defaultValue={100}>
          <NumberField.Input />
        </NumberField.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');

      // Tabbing into an input natively selects the whole value before the focus event fires.
      input.setSelectionRange(0, input.value.length);
      input.focus();
      await flushMicrotasks();

      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });
  });

  describe('consumer-prevented defaults', () => {
    it('does not mark the field focused when the focus default is prevented', async () => {
      await render(
        <Field.Root data-testid="field">
          <NumberField.Root defaultValue={1234}>
            <NumberField.Input onFocusin={(event) => event.preventVaseUIHandler()} />
          </NumberField.Root>
        </Field.Root>,
      );

      screen.getByRole('textbox').focus();
      await flushMicrotasks();

      expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
    });

    it('does not reformat, touch, or commit on blur when the blur default is prevented', async () => {
      const onValueCommitted = vi.fn();

      await render(
        <Field.Root data-testid="field">
          <NumberField.Root onValueCommitted={onValueCommitted}>
            <NumberField.Input onFocusout={(event) => event.preventVaseUIHandler()} />
          </NumberField.Root>
        </Field.Root>,
      );

      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();
      await fireEvent.input(input, { target: { value: '5.10' } });
      await fireEvent.focusOut(input);

      expect(input).toHaveValue('5.10');
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-touched');
      expect(onValueCommitted).not.toHaveBeenCalled();
    });

    it('ignores a change whose native default was already prevented', async () => {
      const onValueChange = vi.fn();

      await render(
        <NumberField.Root defaultValue={5} onValueChange={onValueChange}>
          <NumberField.Input onInput={(event) => event.preventDefault()} />
        </NumberField.Root>,
      );

      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();
      await fireEvent.input(input, { target: { value: '9' }, cancelable: true });

      expect(input).toHaveValue('5');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not step when the keydown default is prevented', async () => {
      const onValueChange = vi.fn();

      await render(
        <NumberField.Root defaultValue={5} onValueChange={onValueChange}>
          <NumberField.Input onKeydown={(event) => event.preventDefault()} />
        </NumberField.Root>,
      );

      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();
      await fireEvent.keyDown(input, { key: 'ArrowUp' });

      expect(input).toHaveValue('5');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('the attributes of the input', () => {
    it('has the attributes of a text input that holds a number', async () => {
      await render(
        <NumberField.Root>
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('inputmode', 'numeric');
      expect(input).toHaveAttribute('autocomplete', 'off');
      expect(input).toHaveAttribute('autocorrect', 'off');
      expect(input).toHaveAttribute('spellcheck', 'false');
      expect(input).toHaveAttribute('aria-roledescription', 'Number field');
      for (const attribute of ['required', 'readonly', 'disabled', 'aria-invalid']) {
        expect(input).not.toHaveAttribute(attribute);
      }
    });

    it('has the `id` of the root', async () => {
      await render(
        <NumberField.Root id="amount">
          <NumberField.Input />
        </NumberField.Root>,
      );

      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'amount');
    });

    it('replaces `aria-roledescription` with the attribute of the consumer', async () => {
      await render(
        <NumberField.Root>
          <NumberField.Input aria-roledescription="Zahlenfeld" />
        </NumberField.Root>,
      );

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-roledescription', 'Zahlenfeld');
    });

    it.each([
      { name: '`required`', props: { required: true }, attribute: 'required' },
      { name: '`readOnly`', props: { readOnly: true }, attribute: 'readonly' },
      { name: '`disabled`', props: { disabled: true }, attribute: 'disabled' },
    ])('has the attribute of $name of the root', async ({ props, attribute }) => {
      await render(
        <NumberField.Root {...props}>
          <NumberField.Input />
        </NumberField.Root>,
      );

      expect(screen.getByRole('textbox')).toHaveAttribute(attribute, '');
    });
  });

  describe('the text of the input', () => {
    it('BUG-5424: keeps the text with dots that are not group separators, and does not change the value', async () => {
      const onValueChange = vi.fn();
      await render(
        <NumberField.Root name="amount" defaultValue={5} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      await fireEvent.input(input, { target: { value: '1.2.3' } });

      expect(input).toHaveValue('1.2.3');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(getHiddenInput().value).toBe('5');

      await fireEvent.focusOut(input);

      expect(input).toHaveValue('1.2.3');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(getHiddenInput().value).toBe('5');
    });

    it('changes the value for a `change` event that has no `input` event', async () => {
      const onValueChange = vi.fn();
      await render(
        <NumberField.Root onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole('textbox');

      await fireEvent.change(input, { target: { value: '42' } });

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toBe(42);
      expect(onValueChange.mock.calls[0][1].reason).toBe(REASONS.inputChange);
      expect(onValueChange.mock.calls[0][1].event.type).toBe('change');
      expect(input).toHaveValue('42');
    });

    it('ignores a `change` event for the text that the input had at the mount', async () => {
      const onValueChange = vi.fn();
      await render(
        <NumberField.Root defaultValue={5} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>,
      );

      await fireEvent.change(screen.getByRole('textbox'));

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('ignores the `change` event of text that an `input` event handled', async () => {
      const onValueChange = vi.fn();
      await render(
        <NumberField.Root onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole('textbox');

      await fireEvent.input(input, { target: { value: '42' } });
      await fireEvent.change(input);

      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('puts the pasted text at the selection, and the caret behind it', async () => {
      const onValueChange = vi.fn();
      await render(
        <NumberField.Root defaultValue={123} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole<HTMLInputElement>('textbox');
      input.focus();
      await flushMicrotasks();
      // The `2` of `123`.
      input.setSelectionRange(1, 2);

      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, 'clipboardData', { value: { getData: () => '99' } });
      await fireEvent(input, pasteEvent);

      expect(pasteEvent.defaultPrevented).toBe(true);
      expect(input).toHaveValue('1993');
      expect([input.selectionStart, input.selectionEnd]).toEqual([3, 3]);
      expect(onValueChange.mock.lastCall?.[0]).toBe(1993);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe(REASONS.inputPaste);
    });

    it('puts the caret behind pasted text that does not change the text', async () => {
      await render(
        <NumberField.Root defaultValue={123}>
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole<HTMLInputElement>('textbox');
      input.focus();
      await flushMicrotasks();
      // The `2` of `123`.
      input.setSelectionRange(1, 2);

      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, 'clipboardData', { value: { getData: () => '2' } });
      await fireEvent(input, pasteEvent);

      expect(input).toHaveValue('123');
      expect([input.selectionStart, input.selectionEnd]).toEqual([2, 2]);
    });

    it.each([
      { name: 'on', allowWheelScrub: true, value: 6 },
      { name: 'off', allowWheelScrub: false, value: 5 },
    ])('scrubs the value with the wheel only while `allowWheelScrub` is $name', async (row) => {
      await render(
        <NumberField.Root defaultValue={5} allowWheelScrub={row.allowWheelScrub}>
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole('textbox');
      input.focus();
      await flushMicrotasks();

      await fireEvent.wheel(input, { deltaY: -100 });

      expect(input).toHaveValue(String(row.value));
    });
  });

  describe('a composition', () => {
    // Playwright has a command for the input method editor only for Chromium.
    const compose = async (session: CDPSession, text: string) => {
      await session.send('Input.imeSetComposition', {
        text,
        selectionStart: text.length,
        selectionEnd: text.length,
      });
      await flushMicrotasks();
    };

    async function renderComposing() {
      const { cdp } = await import('vitest/browser');
      const onValueChange = vi.fn();
      await render(
        <NumberField.Root name="amount" locale="en-US" onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole<HTMLInputElement>('textbox');
      await userEvent.click(input);
      return { session: cdp() as CDPSession, input, onValueChange };
    }

    it.runIf(platform.engine.blink)('accepts a full-width digit', async () => {
      const { session, input, onValueChange } = await renderComposing();

      await compose(session, '１');

      expect(input).toHaveValue('１');
      expect(getHiddenInput().value).toBe('1');
      expect(onValueChange.mock.lastCall?.[0]).toBe(1);
    });

    it.runIf(platform.engine.blink)(
      'keeps the text of the composition while it has a character that the part refuses',
      async () => {
        const { session, input, onValueChange } = await renderComposing();

        await compose(session, 'y');

        expect(input).toHaveValue('y');
        expect(onValueChange).not.toHaveBeenCalled();
      },
    );

    it.runIf(platform.engine.blink)(
      'writes the text of the field when a composition ends with a refused character',
      async () => {
        const { session, input } = await renderComposing();
        await compose(session, '１');

        await compose(session, 'あ');
        await session.send('Input.insertText', { text: 'あ' });

        await waitFor(() => expect(input).toHaveValue('１'));
      },
    );
  });

  describe('a native reset', () => {
    it('VUE-21: starts no validation for the value of a reset', async () => {
      vi.useFakeTimers();
      try {
        const validate = vi.fn((value: unknown) => (typeof value === 'number' ? 'Too big' : null));
        await render(
          <Form data-testid="form">
            <Field.Root
              data-testid="root"
              name="quantity"
              validate={validate}
              validationMode="onChange"
            >
              <NumberField.Root defaultValue={1}>
                <NumberField.Input />
              </NumberField.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>,
        );
        const input = screen.getByRole('textbox');
        await fireEvent.input(input, { target: { value: '9' } });
        expect(validate).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('error')).toHaveTextContent('Too big');

        screen.getByTestId<HTMLFormElement>('form').reset();
        vi.advanceTimersByTime(0);
        await flushMicrotasks();

        expect(input).toHaveValue('1');
        expect(validate).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('error')).toBe(null);
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('hydration', () => {
    it.each([
      {
        name: 'the label first, the description last',
        parts: ['label', 'input', 'description'],
      },
      { name: 'the input first', parts: ['input', 'label', 'description'] },
      {
        name: 'the description first, the label last',
        parts: ['description', 'input', 'label'],
      },
    ])('VUE-17: hydrates with the ids of the server: $name', async ({ parts }) => {
      const props = { parts, defaultValue: 5 };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverInput = template.content.querySelector('[data-testid="input"]');
      const serverId = (testId: string) =>
        template.content.querySelector(`[data-testid="${testId}"]`)?.id;
      expect(serverInput?.getAttribute('aria-labelledby')).toBe(serverId('label'));
      expect(serverInput?.getAttribute('aria-describedby')).toBe(serverId('description'));
      expect(template.content.querySelector('[data-testid="label"]')?.getAttribute('for')).toBe(
        serverInput?.id,
      );
      expect(serverInput?.getAttribute('value')).toBe('5');

      const { container } = await hydrate(NumberFieldInputHydration, { serverHtml, props });

      const input = within(container).getByTestId('input');
      expect(input).toHaveAttribute('aria-labelledby', serverId('label'));
      expect(input).toHaveAttribute('aria-describedby', serverId('description'));
      expect(input).toHaveValue('5');
    });

    it('formats the text in the locale of the runtime after the mount', async () => {
      // A formatter is cached by its locale and its options, so no earlier case formats with these.
      const props = {
        parts: ['input'],
        defaultValue: 1234.5,
        format: { minimumFractionDigits: 3 },
      };
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(template.content.querySelector('[data-testid="input"]')?.getAttribute('value')).toBe(
        '1,234.500',
      );
      mockRuntimeLocale('de-DE');

      const { container } = await hydrate(NumberFieldInputHydration, { serverHtml, props });

      expect(within(container).getByTestId('input')).toHaveValue('1.234,500');
    });
  });

  it('throws a descriptive error when rendered outside <NumberField.Root>', async () => {
    await expect(render(<NumberField.Input />)).rejects.toThrow(
      'Vase UI: A part of Number Field must be inside <NumberField.Root>. Without a root the part has no value to show. Put the part inside <NumberField.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
