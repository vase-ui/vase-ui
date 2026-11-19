import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createApp, shallowRef } from 'vue';
import { useDateTimePickerRoot } from './useDateTimePickerRoot';

interface Details {
  isCanceled: boolean;
  event: Event;
  reason: string;
}

const details = (isCanceled = false): Details => ({
  isCanceled,
  event: new Event('test'),
  reason: 'test',
});

// The composable gives a context to the parts below the root, so it runs in the `setup` of a part.
function runInSetup<Result>(setup: () => Result): Result {
  let result!: Result;
  const app = createApp({
    setup() {
      result = setup();
      return () => null;
    },
  });
  app.mount(document.createElement('div'));
  onTestFinished(() => {
    app.unmount();
  });
  return result;
}

function createPicker(
  options: {
    value?: string | null | undefined;
    defaultValue?: string | null | undefined;
    closeOnSelect?: boolean | undefined;
    hasTime?: (value: string) => boolean;
    valueChange?: (value: string | null, details: Details) => void;
  } = {},
) {
  const value = shallowRef(options.value);
  const updateValue = vi.fn();
  const valueChange = options.valueChange ?? vi.fn();
  const picker = runInSetup(() =>
    useDateTimePickerRoot<string | null, string, Details>(
      {
        get modelValue() {
          return value.value;
        },
        defaultValue: options.defaultValue,
        closeOnSelect: options.closeOnSelect,
      },
      {
        name: 'Picker',
        empty: null,
        templateOf: (candidate) => candidate,
        fallback: 'fallback',
        hasTime: options.hasTime ?? (() => false),
        valueChange,
        updateValue,
      },
    ),
  );
  return { picker, value, valueChange, updateValue };
}

describe('useDateTimePickerRoot', () => {
  describe('template', () => {
    it('is the fallback while the picker has never had a value', () => {
      const { picker } = createPicker();

      expect(picker.template.value).toBe('fallback');
    });

    it('is the default value while the picker has no value', () => {
      const { picker } = createPicker({ defaultValue: 'default' });

      expect(picker.template.value).toBe('default');
    });

    it('is the value', () => {
      const { picker, value } = createPicker({ value: 'first', defaultValue: 'default' });

      value.value = 'second';

      expect(picker.template.value).toBe('second');
    });

    // The next value of a picker that the user empties has the kind of the last value, as the
    // calendar and the field of the picker both make it.
    it('is the last value after the picker becomes empty', () => {
      const { picker, value } = createPicker({ value: 'first' });

      value.value = 'second';
      value.value = null;

      expect(picker.value.value).toBe(null);
      expect(picker.template.value).toBe('second');
    });
  });

  describe('commit', () => {
    it('reports the change, then the update, and an uncontrolled picker takes the value', () => {
      const calls: string[] = [];
      const { picker, updateValue } = createPicker({
        valueChange: (value) => calls.push(`valueChange ${value}`),
      });
      updateValue.mockImplementation((value: string | null) => calls.push(`update ${value}`));

      picker.commit('next', details());

      expect(calls).toEqual(['valueChange next', 'update next']);
      expect(picker.value.value).toBe('next');
    });

    it('stops at a canceled change', () => {
      const { picker, updateValue } = createPicker({ defaultValue: 'start' });

      picker.commit('next', details(true));

      expect(updateValue).not.toHaveBeenCalled();
      expect(picker.value.value).toBe('start');
    });

    it('leaves the value to the parent of a controlled picker', () => {
      const { picker, updateValue } = createPicker({ value: 'start' });

      picker.commit('next', details());

      expect(updateValue).toHaveBeenCalledWith('next');
      expect(picker.value.value).toBe('start');
    });
  });

  describe('reset', () => {
    it('puts an uncontrolled picker back to its default value, with the details of the reset', () => {
      const { picker, valueChange } = createPicker({ defaultValue: 'start' });
      picker.commit('next', details());
      const resetDetails = details();

      picker.reset(resetDetails);

      expect(valueChange).toHaveBeenLastCalledWith('start', resetDetails);
      expect(picker.value.value).toBe('start');
    });

    it('empties an uncontrolled picker that has no default value', () => {
      const { picker } = createPicker();
      picker.commit('next', details());

      picker.reset(details());

      expect(picker.value.value).toBe(null);
    });

    it('does not change a controlled picker', () => {
      const { picker, valueChange } = createPicker({ value: 'start', defaultValue: 'other' });

      picker.reset(details());

      expect(valueChange).not.toHaveBeenCalled();
      expect(picker.value.value).toBe('start');
    });
  });

  describe('closeOnSelect', () => {
    it.each([
      { name: 'a value with no time', hasTime: false, closeOnSelect: undefined, expected: true },
      { name: 'a value with a time', hasTime: true, closeOnSelect: undefined, expected: false },
      { name: 'a prop of true and a time', hasTime: true, closeOnSelect: true, expected: true },
      {
        name: 'a prop of false and no time',
        hasTime: false,
        closeOnSelect: false,
        expected: false,
      },
    ])('is $expected for $name', ({ hasTime, closeOnSelect, expected }) => {
      const { picker } = createPicker({ hasTime: () => hasTime, closeOnSelect });

      expect(picker.closeOnSelect.value).toBe(expected);
    });

    it('asks the kind of the template, so a new kind changes the rule', () => {
      const { picker, value } = createPicker({
        value: 'date',
        hasTime: (kind) => kind === 'date and time',
      });

      expect(picker.closeOnSelect.value).toBe(true);

      value.value = 'date and time';
      expect(picker.closeOnSelect.value).toBe(false);
    });
  });
});

// A range with no end is a value, but it gives no kind to a new value.
describe('useDateTimePickerRoot with a value that can be empty', () => {
  type Range = readonly [string | null, string | null];
  function createRangePicker(options: { value?: Range; defaultValue?: Range } = {}) {
    const value = shallowRef(options.value);
    const picker = runInSetup(() =>
      useDateTimePickerRoot<Range, string, Details>(
        {
          get modelValue() {
            return value.value;
          },
          defaultValue: options.defaultValue,
        },
        {
          name: 'RangePicker',
          empty: [null, null],
          templateOf: ([start, end]) => start ?? end,
          fallback: 'fallback',
          valueChange: vi.fn(),
          updateValue: vi.fn(),
        },
      ),
    );
    return { picker, value };
  }

  it('takes the default value for the template while the value is empty', () => {
    const { picker } = createRangePicker({
      value: [null, null],
      defaultValue: ['default', 'default'],
    });

    expect(picker.template.value).toBe('default');
  });

  it('takes the fallback for the template while the value and the default value are empty', () => {
    const { picker } = createRangePicker({ value: [null, null], defaultValue: [null, null] });

    expect(picker.template.value).toBe('fallback');
  });

  it('is the value while it has one end', () => {
    const { picker } = createRangePicker({ value: ['start', null] });

    expect(picker.template.value).toBe('start');
  });

  it('keeps the last value that had an end after the value becomes empty', () => {
    const { picker, value } = createRangePicker({ value: ['start', 'end'] });

    value.value = [null, null];

    expect(picker.template.value).toBe('start');
  });
});
