import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { shallowRef } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import NumberFieldContextProbe from '../../../test/fixtures/NumberFieldContextProbe.vue';
import { platform } from '../../common/platform';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

// A module namespace is read-only. The mock gives `os` as a plain object, so a case can set `ios`.
vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');
  return { platform: { ...actual.platform, os: { ...actual.platform.os } } };
});

function getText() {
  return screen.getByTestId<HTMLInputElement>('text');
}

// The parts of Number Field read the context of the root. These cases read it through a fixture
// part, and they test what the root gives to each part.
describe('the context of the root of Number Field', () => {
  const { render } = createRenderer();

  async function renderRoot(props: Record<string, unknown> = {}) {
    const handleChange = vi.fn();
    const handleCommit = vi.fn();
    const probe = shallowRef<InstanceType<typeof NumberFieldContextProbe> | null>(null);
    const result = await render(
      <NumberField.Root
        data-testid="root"
        onValueChange={handleChange}
        onValueCommitted={handleCommit}
        {...props}
      >
        <NumberFieldContextProbe ref={probe} />
      </NumberField.Root>,
    );
    return { ...result, getContext: () => probe.value!.context, handleChange, handleCommit };
  }

  describe('the text of the input', () => {
    const percent = { style: 'percent' } as const;
    const currency = { style: 'currency', currency: 'USD' } as const;

    // The text has the locale of the runtime when the root has no `locale` prop.
    it.each([
      {
        name: 'the default locale',
        props: { defaultValue: 1234.5 },
        text: new Intl.NumberFormat().format(1234.5),
      },
      {
        name: 'the `locale` prop',
        props: { defaultValue: 1234.5, locale: 'de-DE' },
        text: new Intl.NumberFormat('de-DE').format(1234.5),
      },
      {
        name: 'the `format` prop',
        props: { defaultValue: 0.5, format: percent },
        text: new Intl.NumberFormat(undefined, percent).format(0.5),
      },
      { name: 'no value', props: {}, text: '' },
    ])('is formatted with $name', async ({ props, text }) => {
      await renderRoot(props);

      expect(getText().value).toBe(text);
    });

    it.each([
      {
        name: 'a new `locale`',
        props: { locale: 'de-DE' },
        text: new Intl.NumberFormat('de-DE').format(1234.5),
      },
      {
        name: 'a new `format`',
        props: { format: currency },
        text: new Intl.NumberFormat(undefined, currency).format(1234.5),
      },
      {
        name: 'a new controlled value',
        props: { value: 2000 },
        text: new Intl.NumberFormat().format(2000),
      },
    ])('is formatted again for $name', async ({ props, text }) => {
      const { setProps } = await renderRoot({ value: 1234.5 });

      await setProps(props);

      expect(getText().value).toBe(text);
    });

    it('keeps the text of an edit that is not a number until the edit ends', async () => {
      const { getContext, setProps } = await renderRoot({ defaultValue: 1 });
      getContext().allowInputSyncRef.value = false;
      getContext().setInputValue('12x');

      await setProps({ locale: 'de-DE' });
      expect(getText().value).toBe('12x');

      getContext().allowInputSyncRef.value = true;
      await setProps({ locale: 'en-US' });
      expect(getText().value).toBe(new Intl.NumberFormat('en-US').format(1));
    });
  });

  it('formats the text again for a change that leaves the value as it was', async () => {
    const { getContext } = await renderRoot({ defaultValue: 1 });
    getContext().allowInputSyncRef.value = false;
    getContext().setInputValue('12x');
    await flushMicrotasks();
    expect(getText().value).toBe('12x');

    getContext().allowInputSyncRef.value = true;
    getContext().setValue(1, createChangeEventDetails(REASONS.inputBlur));
    await flushMicrotasks();

    expect(getText().value).toBe(new Intl.NumberFormat().format(1));
  });

  it('reports a change that a listener cancels as not applied', async () => {
    const { getContext } = await renderRoot({
      defaultValue: 1,
      onValueChange: (_value: number | null, details: NumberField.Root.ChangeEventDetails) =>
        details.cancel(),
    });

    const changed = getContext().setValue(2, createChangeEventDetails(REASONS.inputChange));
    await flushMicrotasks();

    expect(changed).toBe(false);
    expect(getText().value).toBe(new Intl.NumberFormat().format(1));
  });

  describe('incrementValue', () => {
    it.each([
      { name: 'starts an empty field at 0', props: {}, direction: 1, expected: 0 },
      { name: 'starts an empty field at `min`', props: { min: 5 }, direction: 1, expected: 5 },
      { name: 'adds the amount', props: { defaultValue: 10 }, direction: 1, expected: 13 },
      { name: 'subtracts the amount', props: { defaultValue: 10 }, direction: -1, expected: 7 },
      {
        name: 'snaps up to the step',
        props: { defaultValue: 7, step: 3, snapOnStep: true },
        direction: 1,
        expected: 9,
      },
      {
        name: 'snaps down to the step',
        props: { defaultValue: 7, step: 3, snapOnStep: true },
        direction: -1,
        expected: 6,
      },
    ] as const)('$name', async ({ props, direction, expected }) => {
      const { getContext, handleChange } = await renderRoot(props);

      getContext().incrementValue(3, { direction, reason: REASONS.incrementPress });
      await flushMicrotasks();

      expect(handleChange.mock.lastCall?.[0]).toBe(expected);
      expect(getText().value).toBe(new Intl.NumberFormat().format(expected));
    });

    it('steps from the number that the part gives', async () => {
      const { getContext, handleChange } = await renderRoot({ defaultValue: 1 });

      getContext().incrementValue(1, { direction: 1, reason: REASONS.keyboard, currentValue: 40 });

      expect(handleChange.mock.lastCall?.[0]).toBe(41);
    });

    it('steps from the value that the parent gave last', async () => {
      const { getContext, handleChange, setProps } = await renderRoot({ value: 10 });
      await setProps({ value: 20 });

      getContext().incrementValue(1, { direction: 1, reason: REASONS.incrementPress });

      expect(handleChange.mock.lastCall?.[0]).toBe(21);
    });
  });

  it.each([
    { name: 'the `step`', props: { step: 2 }, event: undefined, expected: 2 },
    { name: '1 for `step="any"`', props: { step: 'any' }, event: undefined, expected: 1 },
    {
      name: '`largeStep` for shift',
      props: { largeStep: 20 },
      event: { shiftKey: true },
      expected: 20,
    },
    {
      name: '`smallStep` for alt',
      props: { smallStep: 0.5 },
      event: { altKey: true },
      expected: 0.5,
    },
    {
      name: '`smallStep` for alt and shift',
      props: { smallStep: 0.5 },
      event: { altKey: true, shiftKey: true },
      expected: 0.5,
    },
  ])('getStepAmount gives $name', async ({ props, event, expected }) => {
    const { getContext } = await renderRoot(props);

    expect(getContext().getStepAmount(event)).toBe(expected);
  });

  it.each([
    { name: 'a separator and a sign', props: {}, has: ['.', ',', '-', '+'], hasNot: ['a'] },
    { name: 'no minus sign for a `min` of 0', props: { min: 0 }, has: ['+'], hasNot: ['-', '−'] },
    {
      name: 'a minus sign with `allowOutOfRange`',
      props: { min: 0, allowOutOfRange: true },
      has: ['-'],
      hasNot: [],
    },
    {
      name: 'the symbols of a currency format',
      props: { locale: 'de-DE', format: { style: 'currency', currency: 'EUR' } },
      has: ['€', ','],
      hasNot: ['$'],
    },
    {
      name: 'the symbols of a percent format',
      props: { format: { style: 'percent' } },
      has: ['%', '‰'],
      hasNot: [],
    },
    {
      name: 'the parentheses of an accounting format',
      props: { format: { style: 'currency', currency: 'USD', currencySign: 'accounting' } },
      has: ['(', ')', '$'],
      hasNot: [],
    },
  ])('getAllowedNonNumericKeys has $name', async ({ props, has, hasNot }) => {
    const { getContext } = await renderRoot({ locale: 'en-US', ...props });

    const keys = getContext().getAllowedNonNumericKeys();

    for (const key of has) {
      expect(keys.has(key), key).toBe(true);
    }
    for (const key of hasNot) {
      expect(keys.has(key), key).toBe(false);
    }
  });

  describe('inputMode', () => {
    function setIos(ios: boolean) {
      Object.defineProperty(platform.os, 'ios', { value: ios, configurable: true });
      onTestFinished(() => {
        Object.defineProperty(platform.os, 'ios', { value: false, configurable: true });
      });
    }

    it.each([
      { name: 'is `numeric` off iOS', ios: false, props: { min: 0 }, mode: 'numeric' },
      {
        name: 'is `decimal` on iOS with a `min` of 0',
        ios: true,
        props: { min: 0 },
        mode: 'decimal',
      },
      {
        name: 'is `text` on iOS with a negative `min`',
        ios: true,
        props: { min: -5 },
        mode: 'text',
      },
      { name: 'is `text` on iOS with no `min`', ios: true, props: {}, mode: 'text' },
    ])('$name', async ({ ios, props, mode }) => {
      setIos(ios);

      await renderRoot(props);

      expect(getText()).toHaveAttribute('inputmode', mode);
    });
  });

  describe('focusInput', () => {
    it('forwards the focus of the hidden input to the text input, with the caret at the end', async () => {
      await renderRoot({ defaultValue: 100 });
      getText().setSelectionRange(0, 0);

      document.querySelector<HTMLInputElement>('input[aria-hidden]')!.focus();

      expect(getText()).toHaveFocus();
      expect(getText().selectionStart).toBe(3);
      expect(getText().selectionEnd).toBe(3);
    });

    it('leaves the focus on the hidden input when the field has no text input', async () => {
      await render(<NumberField.Root defaultValue={100} />);
      const input = document.querySelector<HTMLInputElement>('input[aria-hidden]')!;

      input.focus();

      expect(input).toHaveFocus();
    });
  });

  describe('the wheel', () => {
    function wheel(init: WheelEventInit) {
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
      getText().dispatchEvent(event);
      return event;
    }

    async function renderFocused(props: Record<string, unknown> = {}, focus = true) {
      const result = await renderRoot({ allowWheelScrub: true, defaultValue: 5, ...props });
      if (focus) {
        getText().focus();
      }
      return result;
    }

    it.each([
      { name: 'up on a wheel up', init: { deltaY: -1 }, expected: 6 },
      { name: 'down on a wheel down', init: { deltaY: 1 }, expected: 4 },
      {
        name: 'by `largeStep` with the shift key',
        init: { deltaY: -1, shiftKey: true },
        expected: 15,
      },
      {
        name: 'by `largeStep` when shift swaps the axis',
        init: { deltaX: -3, deltaY: 0, shiftKey: true },
        expected: 15,
      },
    ])('scrubs $name and commits it', async ({ init, expected }) => {
      const { handleChange, handleCommit } = await renderFocused();

      const event = wheel(init);
      await flushMicrotasks();

      expect(event.defaultPrevented).toBe(true);
      expect(handleChange.mock.lastCall?.[0]).toBe(expected);
      expect(handleChange.mock.lastCall?.[1].reason).toBe('wheel');
      expect(handleCommit.mock.calls.map(([value, details]) => [value, details.reason])).toEqual([
        [expected, 'wheel'],
      ]);
    });

    it.each([
      { name: 'a horizontal wheel', props: {}, init: { deltaX: 5, deltaY: 1 } },
      { name: 'a pinch zoom', props: {}, init: { deltaY: -1, ctrlKey: true } },
      { name: 'a wheel with no distance', props: {}, init: { deltaY: 0 } },
      {
        name: '`allowWheelScrub` that is off',
        props: { allowWheelScrub: false },
        init: { deltaY: -1 },
      },
      { name: 'a disabled field', props: { disabled: true }, init: { deltaY: -1 } },
      { name: 'a read-only field', props: { readOnly: true }, init: { deltaY: -1 } },
    ])('does not scrub for $name', async ({ props, init }) => {
      const { handleChange, handleCommit } = await renderFocused(props);

      const event = wheel(init);
      await flushMicrotasks();

      expect(event.defaultPrevented).toBe(false);
      expect(handleChange).not.toHaveBeenCalled();
      expect(handleCommit).not.toHaveBeenCalled();
    });

    it('does not scrub while the text input has no focus', async () => {
      const { handleChange } = await renderFocused({}, false);

      const event = wheel({ deltaY: -1 });

      expect(event.defaultPrevented).toBe(false);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('does not commit a step that changes nothing at the boundary', async () => {
      const { handleChange, handleCommit } = await renderFocused({ max: 5 });

      const event = wheel({ deltaY: -1 });
      await flushMicrotasks();

      expect(event.defaultPrevented).toBe(true);
      expect(handleChange).not.toHaveBeenCalled();
      expect(handleCommit).not.toHaveBeenCalled();
    });
  });

  it('emits `valueCommitted` and ends the pending commit', async () => {
    const { getContext, handleCommit } = await renderRoot();
    getContext().setValue(7, createChangeEventDetails(REASONS.inputChange));
    expect(getContext().hasPendingCommitRef.value).toBe(true);
    const details = createGenericEventDetails(REASONS.keyboard);

    getContext().onValueCommitted(7, details);

    expect(handleCommit.mock.calls).toEqual([[7, details]]);
    expect(getContext().hasPendingCommitRef.value).toBe(false);
  });

  it('gives the root the state of a scrub', async () => {
    const { getContext } = await renderRoot();
    expect(screen.getByTestId('root')).not.toHaveAttribute('data-scrubbing');

    getContext().setIsScrubbing(true);
    await flushMicrotasks();

    expect(screen.getByTestId('root')).toHaveAttribute('data-scrubbing');
    expect(getContext().state.value.scrubbing).toBe(true);
  });
});
