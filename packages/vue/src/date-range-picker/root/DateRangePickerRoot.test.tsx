import { describe, expect, it, vi } from 'vitest';
import ErrorsForm from '../../../test/fixtures/ErrorsForm.vue';
import { shallowRef } from 'vue';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Popover } from '@vase-ui/vue/popover';
import { Field } from '@vase-ui/vue/field';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  heldMountFormResetTests,
  popupConformanceTests,
  screen,
  waitFor,
  wait,
  waitForLaterMillisecond,
  waitSingleFrame,
} from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';
import { recordResetListeners } from '../../internals/date-time/picker/test-utils';
import DateRangePickerAnatomy from './DateRangePickerAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);
const today = () => day('2026-11-14');
const range = (start: string, end: string) => [day(start), day(end)] as const;

const dayButton = (iso: string) =>
  document.querySelector<HTMLElement>(`[data-date="${iso}"] button`)!;
const segmentOf = (field: 'start' | 'end', type: string) =>
  screen
    .getByTestId(`${field}-field`)
    .querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const hiddenInputsOf = (container: Element) =>
  [...container.querySelectorAll<HTMLInputElement>('input[aria-hidden]')].map(
    (input) => input.value,
  );
const centerOf = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};
// A real drag holds the pointer on the button where it started, so the events go to that button,
// with the point where the pointer is.
const pointer = (target: Element, buttons = 1) => ({
  button: 0,
  buttons,
  pointerId: 7,
  pointerType: 'mouse',
  clientX: centerOf(target).x,
  clientY: centerOf(target).y,
});
async function drag(from: string, to: string) {
  const first = dayButton(from);
  await fireEvent.pointerDown(first, pointer(first));
  await fireEvent.pointerMove(first, pointer(dayButton(to)));
  await fireEvent.pointerUp(first, pointer(dayButton(to), 0));
}
// The text of the two ends of a call of `valueChange`.
const endsOf = (call: readonly unknown[] | undefined) =>
  (call?.[0] as (Temporal.PlainDate | null)[]).map((end) => end?.toString() ?? null);
const rangeAttributes = () => {
  const find = (name: string) =>
    [...document.querySelectorAll(`td[${name}]`)].map((cell) => cell.getAttribute('data-date'));
  return {
    start: find('data-range-start'),
    middle: find('data-range-middle'),
    end: find('data-range-end'),
  };
};

describe('<DateRangePicker.Root />', () => {
  const { render } = createRenderer();

  it('keeps the handle of a handle attribute closed while the picker is open', async () => {
    const handle = Popover.createHandle();
    const { user } = await renderPicker({ handle });

    await open(user);

    expect(handle.isOpen).toBe(false);
  });

  function renderPicker(props: Record<string, unknown> = {}) {
    return render(
      <DateRangePickerAnatomy
        {...{ locale: 'en-US', timeZone: 'UTC', calendarProps: { today: today() }, ...props }}
      />,
    );
  }

  // The click comes in a later millisecond than the open, so that Vue runs each listener.
  async function open(user: VaseUIRenderResult['user']) {
    await waitForLaterMillisecond(async () => {
      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(screen.getByRole('dialog')).not.toBe(null);
      });
    });
    return screen.getByRole('dialog');
  }

  // The element is the popup that the test got before the action.
  async function expectClosed(popup: HTMLElement) {
    await waitFor(() => {
      expect(popup).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).toBe(null);
  }

  popupConformanceTests({
    createComponent: (props) => (
      <DateRangePicker.Root {...props.root}>
        <DateRangePicker.Trigger {...props.trigger}>Open menu</DateRangePicker.Trigger>
        <DateRangePicker.Portal {...props.portal}>
          <DateRangePicker.Positioner>
            <DateRangePicker.Popup {...props.popup}>Content</DateRangePicker.Popup>
          </DateRangePicker.Positioner>
        </DateRangePicker.Portal>
      </DateRangePicker.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'dialog',
  });

  it('renders no element of its own', async () => {
    const { container } = await render(
      <DateRangePicker.Root>
        <span data-testid="child" />
      </DateRangePicker.Root>,
    );

    expect(container.firstElementChild).toBe(screen.getByTestId('child'));
  });

  describe('the focus', () => {
    it('goes to the day that has the tab stop when the popup opens: the first day of the range', async () => {
      const { user } = await renderPicker({ defaultValue: range('2026-11-18', '2026-11-20') });

      await open(user);

      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });
    });

    it('goes to today when the picker has no value', async () => {
      const { user } = await renderPicker();

      await open(user);

      await waitFor(() => {
        expect(dayButton('2026-11-14')).toHaveFocus();
      });
    });

    it('goes to the day each time that a popup that stays mounted opens', async () => {
      const { user } = await renderPicker({
        defaultValue: range('2026-11-18', '2026-11-20'),
        keepMounted: true,
      });

      await open(user);
      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
      await open(user);

      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });
    });

    it.each([{ field: 'start' as const }, { field: 'end' as const }])(
      'goes to the day when Alt+Down in a segment of the $field field opens the popup',
      async ({ field }) => {
        const { user } = await renderPicker({ defaultValue: range('2026-11-18', '2026-11-20') });

        segmentOf(field, 'day').focus();
        await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

        await waitFor(() => {
          expect(dayButton('2026-11-18')).toHaveFocus();
        });
        expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
      },
    );

    describe('prop: initialFocus of the popup', () => {
      // The day has the focus by default, so each case shows that the value of the consumer wins.
      it('moves no focus for `false`', async () => {
        const { user } = await renderPicker({
          defaultValue: range('2026-11-18', '2026-11-20'),
          popupProps: { initialFocus: false },
        });

        await open(user);
        await waitSingleFrame();
        await waitSingleFrame();

        expect(screen.getByTestId('trigger')).toHaveFocus();
      });

      it.each([
        { name: '`true`', createOption: () => true },
        { name: '`null`', createOption: () => null },
        { name: 'an empty ref', createOption: () => shallowRef(null) },
      ])('moves the focus to the default element for $name', async ({ createOption }) => {
        const { user } = await renderPicker({
          defaultValue: range('2026-11-18', '2026-11-20'),
          popupProps: { initialFocus: createOption() },
        });

        await open(user);

        await waitFor(() => {
          expect(dayButton('2026-11-18')).toHaveFocus();
        });
      });

      it.each([
        { name: '`true`', result: true },
        { name: '`null`', result: null },
      ])(
        'moves the focus to the default element when a function gives $name',
        async ({ result }) => {
          const { user } = await renderPicker({
            defaultValue: range('2026-11-18', '2026-11-20'),
            popupProps: { initialFocus: () => result },
          });

          await open(user);

          await waitFor(() => {
            expect(dayButton('2026-11-18')).toHaveFocus();
          });
        },
      );

      it('moves the focus to the element that a function gives', async () => {
        const { user } = await renderPicker({
          defaultValue: range('2026-11-18', '2026-11-20'),
          popupProps: { initialFocus: () => screen.getByRole('button', { name: 'Close' }) },
        });

        await open(user);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
        });
      });
    });

    it('goes back to the trigger when Escape closes the popup, and the range stays', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-18', '2026-11-20'),
        onValueChange,
      });
      const popup = await open(user);
      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });

      await user.keyboard('{ArrowRight}{Escape}');

      await expectClosed(popup);
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputsOf(container)).toEqual(['2026-11-18', '2026-11-20']);
    });
  });

  describe('the selection', () => {
    it('keeps the popup open after the first press, and shows that day as the start', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-10', '2026-11-12'),
        onValueChange,
      });
      await open(user);

      await user.click(dayButton('2026-11-16'));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(endsOf(onValueChange.mock.lastCall)).toEqual(['2026-11-16', null]);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('day-press');
      expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '']);
      expect(segmentOf('start', 'day').value).toBe('16');
      expect(segmentOf('end', 'day').value).toBe('');
      expect(rangeAttributes().start).toEqual(['2026-11-16']);
    });

    it('closes the popup after the second press, and gives the range to the fields', async () => {
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-10', '2026-11-12'),
        onValueChange,
        onOpenChange,
      });
      const popup = await open(user);

      await user.click(dayButton('2026-11-16'));
      await user.click(dayButton('2026-11-20'));

      await expectClosed(popup);
      expect(endsOf(onValueChange.mock.lastCall)).toEqual(['2026-11-16', '2026-11-20']);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('day-press');
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('imperative-action');
      expect(onOpenChange.mock.lastCall?.[1].event.type).toBe('click');
      expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '2026-11-20']);
      expect(segmentOf('start', 'day').value).toBe('16');
      expect(segmentOf('end', 'day').value).toBe('20');
      expect(screen.getByTestId('trigger').getAttribute('aria-label')).toContain('November 16');
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
    });

    it('puts the ends in the order of the calendar when the second press is before the first', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderPicker({ onValueChange });
      const popup = await open(user);

      await user.click(dayButton('2026-11-20'));
      await user.click(dayButton('2026-11-16'));

      await expectClosed(popup);
      expect(endsOf(onValueChange.mock.lastCall)).toEqual(['2026-11-16', '2026-11-20']);
    });

    it('closes the popup after a press that makes a range of one day', async () => {
      const { user, container } = await renderPicker();
      const popup = await open(user);

      await user.click(dayButton('2026-11-16'));
      await user.click(dayButton('2026-11-16'));

      await expectClosed(popup);
      expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '2026-11-16']);
    });

    it('closes the popup after Enter on the second day', async () => {
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-10', '2026-11-12'),
      });
      const popup = await open(user);
      await user.click(dayButton('2026-11-16'));
      await waitFor(() => {
        expect(dayButton('2026-11-16')).toHaveFocus();
      });

      await user.keyboard('{ArrowRight}{ArrowRight}{Enter}');

      await expectClosed(popup);
      expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '2026-11-18']);
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
    });

    it('closes the popup after a drag, which makes the range in one change', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({ onValueChange });
      const popup = await open(user);
      const first = dayButton('2026-11-16');

      await fireEvent.pointerDown(first, pointer(first));
      await fireEvent.pointerMove(first, pointer(dayButton('2026-11-18')));
      expect(screen.getByRole('dialog')).not.toBe(null);
      await fireEvent.pointerUp(first, pointer(dayButton('2026-11-18'), 0));

      await expectClosed(popup);
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(endsOf(onValueChange.mock.lastCall)).toEqual(['2026-11-16', '2026-11-18']);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('drag');
      expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '2026-11-18']);
    });

    // The calendar emits no change for such a drag, so no `valueChange` tells the picker.
    it('closes the popup after a drag that makes the range that the picker already has', async () => {
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-16', '2026-11-18'),
        onValueChange,
        onOpenChange,
      });
      const popup = await open(user);
      onOpenChange.mockClear();

      await drag('2026-11-16', '2026-11-18');

      await expectClosed(popup);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('imperative-action');
      expect(onOpenChange.mock.lastCall?.[1].event.type).toBe('pointerup');
      expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '2026-11-18']);
    });

    it('keeps the popup open when a key extends the range, because the user can extend it more', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({ onValueChange });
      await open(user);
      await user.click(dayButton('2026-11-16'));
      await waitFor(() => {
        expect(dayButton('2026-11-16')).toHaveFocus();
      });

      await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
      await flushMicrotasks();

      expect(endsOf(onValueChange.mock.lastCall)).toEqual(['2026-11-16', '2026-11-17']);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('keyboard');
      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '2026-11-17']);
    });

    it('keeps the popup open when a listener cancels the change of the value', async () => {
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-10', '2026-11-12'),
        onValueChange: (_value: unknown, details: { cancel: () => void }) => {
          details.cancel();
        },
      });
      await open(user);

      await user.click(dayButton('2026-11-16'));
      await user.click(dayButton('2026-11-20'));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(hiddenInputsOf(container)).toEqual(['2026-11-10', '2026-11-12']);
    });

    it('keeps the popup open when a listener cancels the close, and the range changes', async () => {
      const { user, container } = await renderPicker({
        onOpenChange: (open: boolean, details: { cancel: () => void }) => {
          if (!open) {
            details.cancel();
          }
        },
      });
      await open(user);

      await user.click(dayButton('2026-11-16'));
      await user.click(dayButton('2026-11-20'));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
      expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '2026-11-20']);
    });

    describe('prop: closeOnSelect', () => {
      it('keeps the popup open for `false`, and the second press still gives the range', async () => {
        const { user, container } = await renderPicker({ closeOnSelect: false });
        await open(user);

        await user.click(dayButton('2026-11-16'));
        await user.click(dayButton('2026-11-20'));
        await flushMicrotasks();

        expect(screen.getByRole('dialog')).not.toBe(null);
        expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '2026-11-20']);
      });

      it('keeps the popup open for `false` after a drag that makes the range that the picker has', async () => {
        const { user } = await renderPicker({
          defaultValue: range('2026-11-16', '2026-11-18'),
          closeOnSelect: false,
        });
        await open(user);

        await drag('2026-11-16', '2026-11-18');
        await flushMicrotasks();

        expect(screen.getByRole('dialog')).not.toBe(null);
      });

      // The popup has no part for a time, so the user sets a time in a field.
      it('is `true` by default, also for a range with a time', async () => {
        const { user, container } = await renderPicker({
          defaultValue: [
            Temporal.PlainDateTime.from('2026-11-10T09:00'),
            Temporal.PlainDateTime.from('2026-11-12T17:30'),
          ],
        });
        const popup = await open(user);

        await user.click(dayButton('2026-11-16'));
        await user.click(dayButton('2026-11-20'));

        await expectClosed(popup);
        // Each end keeps the time of the end that it replaces.
        expect(hiddenInputsOf(container)).toEqual(['2026-11-16T09:00', '2026-11-20T17:30']);
      });

      it('is `true` by default for a granularity with a time, with no value', async () => {
        const { user } = await renderPicker({ granularity: 'minute' });
        const popup = await open(user);

        await user.click(dayButton('2026-11-16'));
        await user.click(dayButton('2026-11-20'));

        await expectClosed(popup);
      });
    });

    describe('a press on a day that cannot be selected', () => {
      it('keeps the popup open for an unavailable day', async () => {
        const { user, container } = await renderPicker({
          defaultValue: range('2026-11-10', '2026-11-12'),
          unavailableDates: day('2026-11-20'),
        });
        await open(user);

        await user.click(dayButton('2026-11-16'));
        await user.click(dayButton('2026-11-20'));
        await flushMicrotasks();

        expect(screen.getByRole('dialog')).not.toBe(null);
        expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '']);
      });

      it('keeps the popup open for each press in a read-only picker', async () => {
        const { user, container } = await renderPicker({
          defaultValue: range('2026-11-10', '2026-11-12'),
          defaultOpen: true,
          readOnly: true,
        });
        await waitFor(() => {
          expect(dayButton('2026-11-20')).not.toBe(null);
        });

        await user.click(dayButton('2026-11-16'));
        await user.click(dayButton('2026-11-20'));
        await flushMicrotasks();

        expect(screen.getByRole('dialog')).not.toBe(null);
        expect(hiddenInputsOf(container)).toEqual(['2026-11-10', '2026-11-12']);
      });
    });
  });

  describe('the Escape key', () => {
    it('puts back the range from before the first press, and closes the popup', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-10', '2026-11-12'),
        onValueChange,
      });
      const popup = await open(user);
      await user.click(dayButton('2026-11-16'));
      await waitFor(() => {
        expect(dayButton('2026-11-16')).toHaveFocus();
      });
      expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '']);

      await user.keyboard('{Escape}');

      await expectClosed(popup);
      expect(endsOf(onValueChange.mock.lastCall)).toEqual(['2026-11-10', '2026-11-12']);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('keyboard');
      expect(hiddenInputsOf(container)).toEqual(['2026-11-10', '2026-11-12']);
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
    });

    it('puts back the range when the focus is on a button of the calendar that is not a day', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-10', '2026-11-12'),
        onValueChange,
      });
      const popup = await open(user);
      await user.click(dayButton('2026-11-16'));
      expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '']);
      screen.getByTestId('next').focus();

      await user.keyboard('{Escape}');

      await expectClosed(popup);
      expect(endsOf(onValueChange.mock.lastCall)).toEqual(['2026-11-10', '2026-11-12']);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('keyboard');
      expect(hiddenInputsOf(container)).toEqual(['2026-11-10', '2026-11-12']);
    });
  });

  describe('a press outside the popup', () => {
    it('closes the popup and keeps a range that has two ends', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-18', '2026-11-20'),
        onValueChange,
      });
      const popup = await open(user);

      await user.click(document.body);

      await expectClosed(popup);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputsOf(container)).toEqual(['2026-11-18', '2026-11-20']);
    });

    it('closes the popup and keeps the range in progress', async () => {
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-18', '2026-11-20'),
      });
      const popup = await open(user);
      await user.click(dayButton('2026-11-24'));

      await user.click(document.body);

      await expectClosed(popup);
      expect(hiddenInputsOf(container)).toEqual(['2026-11-24', '']);
    });
  });

  describe('the value', () => {
    it('is one range for the fields and the calendar: a day typed in the start field is the start in the calendar', async () => {
      const { user } = await renderPicker({ defaultValue: range('2026-11-18', '2026-11-20') });

      segmentOf('start', 'day').focus();
      await user.keyboard('{ArrowDown}');
      await open(user);

      await waitFor(() => {
        expect(dayButton('2026-11-17')).toHaveFocus();
      });
      expect(rangeAttributes()).toEqual({
        start: ['2026-11-17'],
        middle: ['2026-11-18', '2026-11-19'],
        end: ['2026-11-20'],
      });
    });

    it('follows a new range of a controlled picker in the fields, the calendar and the trigger', async () => {
      const { setProps, container } = await renderPicker({
        modelValue: range('2026-11-18', '2026-11-20'),
        defaultOpen: true,
      });
      await waitFor(() => {
        expect(dayButton('2026-11-18')).not.toBe(null);
      });

      await setProps({ modelValue: range('2026-11-22', '2026-11-24') });

      expect(hiddenInputsOf(container)).toEqual(['2026-11-22', '2026-11-24']);
      expect(rangeAttributes().start).toEqual(['2026-11-22']);
      expect(screen.getByTestId('trigger').getAttribute('aria-label')).toContain('November 22');
    });

    it('does not change a controlled picker until the parent gives the new range', async () => {
      const onUpdateValue = vi.fn();
      const { user, container } = await renderPicker({
        modelValue: range('2026-11-18', '2026-11-20'),
        defaultOpen: true,
        'onUpdate:modelValue': onUpdateValue,
      });
      await waitFor(() => {
        expect(dayButton('2026-11-22')).not.toBe(null);
      });

      await user.click(dayButton('2026-11-22'));

      expect(endsOf(onUpdateValue.mock.lastCall)).toEqual(['2026-11-22', null]);
      expect(hiddenInputsOf(container)).toEqual(['2026-11-18', '2026-11-20']);
    });

    it('is a controlled empty range for `null`', async () => {
      const onUpdateValue = vi.fn();
      const { user, container, setProps } = await renderPicker({
        modelValue: null,
        defaultOpen: true,
        'onUpdate:modelValue': onUpdateValue,
      });
      await waitFor(() => {
        expect(dayButton('2026-11-16')).not.toBe(null);
      });

      await user.click(dayButton('2026-11-16'));

      expect(endsOf(onUpdateValue.mock.lastCall)).toEqual(['2026-11-16', null]);
      expect(hiddenInputsOf(container)).toEqual(['', '']);

      await setProps({ modelValue: range('2026-11-16', '2026-11-18') });

      expect(hiddenInputsOf(container)).toEqual(['2026-11-16', '2026-11-18']);
    });

    it('gives the empty fields the kind of the last range when the user empties them', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderPicker({
        defaultValue: [
          Temporal.ZonedDateTime.from('2026-11-18T09:30[Asia/Tokyo]'),
          Temporal.ZonedDateTime.from('2026-11-20T09:30[Asia/Tokyo]'),
        ],
        hourCycle: 24,
        onValueChange,
      });

      segmentOf('end', 'month').focus();
      await user.keyboard('{Backspace}{Backspace}');
      expect(endsOf(onValueChange.mock.lastCall)).toEqual([
        '2026-11-18T09:30:00+09:00[Asia/Tokyo]',
        null,
      ]);
      await user.keyboard('12');

      expect(endsOf(onValueChange.mock.lastCall)).toEqual([
        '2026-11-18T09:30:00+09:00[Asia/Tokyo]',
        '2026-12-20T09:30:00+09:00[Asia/Tokyo]',
      ]);
    });

    it('makes a range of the kind of the last range after the picker becomes empty', async () => {
      const onValueChange = vi.fn();
      const { user, setProps } = await renderPicker({
        modelValue: [
          Temporal.ZonedDateTime.from('2026-11-18T09:30[Asia/Tokyo]'),
          Temporal.ZonedDateTime.from('2026-11-20T17:45[Asia/Tokyo]'),
        ],
        defaultOpen: true,
        onValueChange,
      });
      await waitFor(() => {
        expect(dayButton('2026-11-16')).not.toBe(null);
      });
      await setProps({ modelValue: [null, null] });

      await user.click(dayButton('2026-11-16'));

      expect(endsOf(onValueChange.mock.lastCall)).toEqual([
        '2026-11-16T09:30:00+09:00[Asia/Tokyo]',
        null,
      ]);
    });
  });

  describe('the validity of the ends', () => {
    it('makes the end field invalid when its day is before the start', async () => {
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-18', '2026-11-20'),
      });
      const [start, end] = [...container.querySelectorAll<HTMLInputElement>('input[aria-hidden]')];
      expect(end!.validity.rangeUnderflow).toBe(false);

      segmentOf('end', 'day').focus();
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');

      expect(hiddenInputsOf(container)).toEqual(['2026-11-18', '2026-11-17']);
      expect(end!.validity.rangeUnderflow).toBe(true);
      expect(end).toHaveAttribute('min', '2026-11-18');
      expect(start!.validity.valid).toBe(true);
    });

    it('makes the end field invalid when the start moves after it, and valid when it moves back', async () => {
      const { user, container } = await renderPicker({
        defaultValue: range('2026-11-18', '2026-11-20'),
      });
      const end = container.querySelectorAll<HTMLInputElement>('input[aria-hidden]')[1]!;

      segmentOf('start', 'day').focus();
      await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');

      expect(hiddenInputsOf(container)).toEqual(['2026-11-21', '2026-11-20']);
      expect(end.validity.rangeUnderflow).toBe(true);

      await user.keyboard('{ArrowDown}');

      expect(end.validity.rangeUnderflow).toBe(false);
    });

    it('takes the later of the start and `minDate` for the limit of the end field', async () => {
      const { container } = await renderPicker({
        defaultValue: range('2026-11-18', '2026-11-20'),
        minDate: day('2026-11-19'),
      });
      const [start, end] = [...container.querySelectorAll<HTMLInputElement>('input[aria-hidden]')];

      expect(start).toHaveAttribute('min', '2026-11-19');
      expect(end).toHaveAttribute('min', '2026-11-19');
    });

    // The two ends have a time, so the end field compares the time of a day too.
    it.each([
      {
        name: 'dates with a time',
        make: (text: string) => Temporal.PlainDateTime.from(text),
        validity: 'rangeUnderflow',
        texts: ['2026-11-18T09:00', '2026-11-18T08:00'],
      },
      {
        name: 'dates with a time in a zone',
        make: (text: string) => Temporal.ZonedDateTime.from(`${text}[Asia/Tokyo]`),
        validity: 'customError',
        texts: ['2026-11-18T09:00+09:00[Asia/Tokyo]', '2026-11-18T08:00+09:00[Asia/Tokyo]'],
      },
    ] as const)(
      'makes the end field invalid for $name when its time is before the start time of one day',
      async ({ make, validity, texts }) => {
        const { user, container } = await renderPicker({
          defaultValue: [make('2026-11-18T09:00'), make('2026-11-18T17:00')],
          hourCycle: 24,
        });
        const [start, end] = [
          ...container.querySelectorAll<HTMLInputElement>('input[aria-hidden]'),
        ];
        expect(end!.validity.valid).toBe(true);

        segmentOf('end', 'hour').focus();
        await user.keyboard('{ArrowDown}'.repeat(9));

        expect(hiddenInputsOf(container)).toEqual(texts);
        expect(end!.validity[validity]).toBe(true);
        expect(start!.validity.valid).toBe(true);

        await user.keyboard('{ArrowUp}');

        expect(end!.validity.valid).toBe(true);
      },
    );

    // The ends of a trip can be in two zones. The end field compares the moments, and not the wall
    // clocks: 20:00 in Tokyo is 11:00 UTC, and 10:00 in New York on the same day is 15:00 UTC.
    it.each([
      {
        name: 'later by the moment and earlier by the wall clock',
        start: '2026-11-10T20:00[Asia/Tokyo]',
        end: '2026-11-10T10:00[America/New_York]',
        isValid: true,
      },
      {
        name: 'earlier by the moment and later by the wall clock',
        start: '2026-11-10T10:00[America/New_York]',
        end: '2026-11-10T20:00[Asia/Tokyo]',
        isValid: false,
      },
    ])('compares the ends in two time zones by the moment: the end is $name', async (row) => {
      const { container } = await renderPicker({
        defaultValue: [
          Temporal.ZonedDateTime.from(row.start),
          Temporal.ZonedDateTime.from(row.end),
        ],
        hourCycle: 24,
      });
      const end = container.querySelectorAll<HTMLInputElement>('input[aria-hidden]')[1]!;

      expect(end.validity.valid).toBe(row.isValid);
    });

    it('takes the later of the start and `minDate` for the limit of the end field, by the time too', async () => {
      const { container } = await renderPicker({
        defaultValue: [
          Temporal.PlainDateTime.from('2026-11-18T09:00'),
          Temporal.PlainDateTime.from('2026-11-20T17:00'),
        ],
        minDate: Temporal.PlainDateTime.from('2026-11-18T08:00'),
      });
      const [start, end] = [...container.querySelectorAll<HTMLInputElement>('input[aria-hidden]')];

      expect(start).toHaveAttribute('min', '2026-11-18T08:00');
      expect(end).toHaveAttribute('min', '2026-11-18T09:00');
    });

    // A zoned value has a text input, so the field reports its limit with a custom error.
    it('makes the end field of a zoned range invalid when its day is before the start', async () => {
      const zoned = (text: string) => Temporal.ZonedDateTime.from(`${text}T09:30[Asia/Tokyo]`);
      const { user, container } = await renderPicker({
        defaultValue: [zoned('2026-11-18'), zoned('2026-11-20')],
        hourCycle: 24,
      });
      const end = container.querySelectorAll<HTMLInputElement>('input[aria-hidden]')[1]!;
      expect(end.validity.valid).toBe(true);

      segmentOf('end', 'day').focus();
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');

      expect(end.value).toBe('2026-11-17T09:30+09:00[Asia/Tokyo]');
      expect(end.validity.customError).toBe(true);
    });
  });

  describe('prop: disabled and readOnly', () => {
    it('does not open a disabled picker, and the fields ignore the user', async () => {
      const { user } = await renderPicker({
        defaultValue: range('2026-11-18', '2026-11-20'),
        disabled: true,
      });

      await user.click(screen.getByTestId('trigger'));

      expect(screen.queryByRole('dialog')).toBe(null);
      expect(segmentOf('start', 'day')).toBeDisabled();
      expect(segmentOf('end', 'day')).toBeDisabled();
    });

    it('is disabled by a disabled Field around it', async () => {
      const { user } = await render(
        <Field.Root disabled>
          <DateRangePickerAnatomy
            {...{ locale: 'en-US', defaultValue: range('2026-11-18', '2026-11-20') }}
          />
        </Field.Root>,
      );

      await user.click(screen.getByTestId('trigger'));

      expect(screen.getByTestId('trigger')).toBeDisabled();
      expect(screen.queryByRole('dialog')).toBe(null);
    });

    it('does not open a read-only picker', async () => {
      const { user } = await renderPicker({
        defaultValue: range('2026-11-18', '2026-11-20'),
        readOnly: true,
      });

      await user.click(screen.getByTestId('trigger'));

      expect(screen.queryByRole('dialog')).toBe(null);
    });
  });

  describe('VUE-112: a disabled fieldset', () => {
    // The root has no element, so its start field tells it which fieldset it is in.
    it('disables the trigger and the calendar of a picker in a disabled fieldset', async () => {
      await render(() => (
        <fieldset disabled>
          <DateRangePickerAnatomy
            {...{
              locale: 'en-US',
              timeZone: 'UTC',
              calendarProps: { today: today() },
              defaultValue: range('2026-11-18', '2026-11-20'),
              defaultOpen: true,
            }}
          />
        </fieldset>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('calendar')).toHaveAttribute('data-disabled');
      });
      expect(screen.getByTestId('trigger')).toHaveAttribute('data-disabled');
      expect(dayButton('2026-11-18')).toHaveAttribute('data-disabled');
    });

    it('disables the trigger of a picker that has no field, in a disabled fieldset', async () => {
      await render(() => (
        <fieldset disabled>
          <DateRangePickerAnatomy
            {...{
              locale: 'en-US',
              timeZone: 'UTC',
              hasFields: false,
              defaultValue: range('2026-11-18', '2026-11-20'),
            }}
          />
        </fieldset>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveAttribute('data-disabled');
      });
    });
  });

  describe('form', () => {
    heldMountFormResetTests({
      render,
      renderControl: () => (
        <DateRangePickerAnatomy
          {...{
            locale: 'en-US',
            timeZone: 'UTC',
            startName: 'from',
            endName: 'to',
            defaultValue: range('2026-11-18', '2026-11-20'),
            calendarProps: { today: today() },
          }}
        />
      ),
      change: () =>
        fireEvent.input(document.querySelector<HTMLInputElement>('input[aria-hidden]')!, {
          target: { value: '2026-11-10' },
        }),
      readState: () =>
        screen.getAllByRole('spinbutton').map((segment) => segment.getAttribute('aria-valuenow')),
      defaultState: ['11', '18', '2026', '11', '20', '2026'],
      changedState: ['11', '10', '2026', '11', '20', '2026'],
    });

    // The two fields get the range of a reset with the next render. The picker counts the reset
    // first, so each field takes that range as the range of the reset, whichever of the four
    // listeners hears of the reset first: the root or the part, of the start or of the end.
    describe.each([{ order: 'the roots first' }, { order: 'the parts first' }])(
      'VUE-21: a native reset clears the error of the field, with $order',
      ({ order }) => {
        // The reset value, `null`, is also an error, so a validation after the reset shows.
        const validate = vi.fn((value: unknown) =>
          value === null ? 'Choose a date' : 'Wrong date',
        );

        function renderForm(
          pickerProps: Record<string, unknown> = {},
          errors?: Record<string, string>,
        ) {
          return (
            <ErrorsForm data-testid="form" errors={errors}>
              <Field.Root
                data-testid="root"
                name="trip"
                validate={validate}
                validationMode="change"
              >
                <DateRangePickerAnatomy
                  {...{
                    locale: 'en-US',
                    timeZone: 'UTC',
                    calendarProps: { today: today() },
                    ...pickerProps,
                  }}
                />
                <Field.Error data-testid="error" />
              </Field.Root>
            </ErrorsForm>
          );
        }

        const hiddenInputElements = (container: Element) => [
          ...container.querySelectorAll<HTMLInputElement>('input[aria-hidden]'),
        ];

        // A program that fills the form sends the whole date in one event.
        async function fill(input: HTMLInputElement, text: string) {
          input.value = text;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await flushMicrotasks();
        }

        async function resetForm(resets: ReturnType<typeof recordResetListeners>) {
          if (order === 'the parts first') {
            // The listener of the root and the listener of the part, for each of the two fields.
            resets.reverse(4);
          }
          screen.getByTestId<HTMLFormElement>('form').reset();
          // Each timeout of the reset starts before this one, and a flush of Vue comes after each.
          await wait(0);
          await flushMicrotasks();
        }

        function expectNeutralField() {
          expect(screen.queryByTestId('error')).toBe(null);
          expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
          expect(screen.getByTestId('root')).not.toHaveAttribute('data-valid');
        }

        it('starts no validation for the range of the reset, and validates the next entry', async () => {
          validate.mockClear();
          const resets = recordResetListeners(document);
          const { container } = await render(renderForm());
          const [start, end] = hiddenInputElements(container);
          await fill(start!, '2026-11-14');
          await fill(end!, '2026-11-20');
          await flushMicrotasks();
          expect(screen.getByTestId('error')).toHaveTextContent('Wrong date');
          validate.mockClear();

          await resetForm(resets);

          expect(hiddenInputsOf(container)).toEqual(['', '']);
          expect(validate).not.toHaveBeenCalled();
          expectNeutralField();

          // The start field is the control of the field.
          await fill(start!, '2026-11-15');
          await flushMicrotasks();

          expect(validate).toHaveBeenCalledTimes(1);
          expect(screen.getByTestId('error')).toHaveTextContent('Wrong date');
        });

        it('clears the error of the form when the reset leaves the range, and validates the next entry', async () => {
          validate.mockClear();
          const resets = recordResetListeners(document);
          const { container } = await render(
            renderForm(
              { defaultValue: range('2026-11-18', '2026-11-20') },
              { trip: 'Server error' },
            ),
          );
          expect(screen.getByTestId('error')).toHaveTextContent('Server error');

          await resetForm(resets);

          expect(hiddenInputsOf(container)).toEqual(['2026-11-18', '2026-11-20']);
          expect(validate).not.toHaveBeenCalled();
          expectNeutralField();

          // The start field is the control of the field.
          await fill(hiddenInputElements(container)[0]!, '2026-11-15');
          await flushMicrotasks();

          expect(validate).toHaveBeenCalledTimes(1);
          expect(screen.getByTestId('error')).toHaveTextContent('Wrong date');
        });
      },
    );

    it('submits one entry for each end, with the names of the root', async () => {
      const { container } = await render(
        <form>
          <DateRangePickerAnatomy
            {...{
              locale: 'en-US',
              defaultValue: range('2026-11-18', '2026-11-20'),
              startName: 'from',
              endName: 'to',
            }}
          />
        </form>,
      );

      const data = new FormData(container.querySelector('form')!);

      expect(data.getAll('from')).toEqual(['2026-11-18']);
      expect(data.getAll('to')).toEqual(['2026-11-20']);
    });

    it('submits the start and no end for a range with one end', async () => {
      const { container } = await render(
        <form>
          <DateRangePickerAnatomy
            {...{
              locale: 'en-US',
              defaultValue: [day('2026-11-18'), null],
              startName: 'from',
              endName: 'to',
            }}
          />
        </form>,
      );

      const data = new FormData(container.querySelector('form')!);

      expect(data.getAll('from')).toEqual(['2026-11-18']);
      expect(data.getAll('to')).toEqual(['']);
    });

    // A control takes the name of its `Field`, so a `Field` with a name gives one name to the two
    // hidden inputs.
    it('has the name of a Field with a name in each hidden input, in the place of its own names', async () => {
      const { container } = await render(
        <Field.Root name="trip">
          <DateRangePickerAnatomy
            {...{
              locale: 'en-US',
              defaultValue: range('2026-11-18', '2026-11-20'),
              startName: 'from',
              endName: 'to',
            }}
          />
        </Field.Root>,
      );

      const names = [...container.querySelectorAll('input[aria-hidden]')].map((input) =>
        input.getAttribute('name'),
      );

      expect(names).toEqual(['trip', 'trip']);
    });

    it('needs a value in each end for `required`', async () => {
      const { container } = await renderPicker({
        defaultValue: [day('2026-11-18'), null],
        required: true,
      });
      const [start, end] = [...container.querySelectorAll<HTMLInputElement>('input[aria-hidden]')];

      expect(start).toBeRequired();
      expect(end).toBeRequired();
      expect(start!.validity.valueMissing).toBe(false);
      expect(end!.validity.valueMissing).toBe(true);
    });

    it('goes back to its default range one time at a reset of the form, when it is not controlled', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <form>
          <DateRangePickerAnatomy
            {...{
              locale: 'en-US',
              defaultValue: range('2026-11-18', '2026-11-20'),
              startName: 'from',
              endName: 'to',
              onValueChange,
            }}
          />
        </form>,
      );

      segmentOf('start', 'day').focus();
      await user.keyboard('{ArrowDown}');
      expect(hiddenInputsOf(container)).toEqual(['2026-11-17', '2026-11-20']);
      onValueChange.mockClear();

      container.querySelector('form')!.reset();

      await waitFor(() => {
        expect(hiddenInputsOf(container)).toEqual(['2026-11-18', '2026-11-20']);
      });
      // The two fields hear the same event, and the picker has one value.
      await wait(20);
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(endsOf(onValueChange.mock.lastCall)).toEqual(['2026-11-18', '2026-11-20']);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('none');
      expect(onValueChange.mock.lastCall?.[1].event.type).toBe('reset');
      expect(segmentOf('start', 'day').value).toBe('18');
    });

    it('does not change at a reset of the form, when it is controlled', async () => {
      const onValueChange = vi.fn();
      const { container } = await render(
        <form>
          <DateRangePickerAnatomy
            {...{
              locale: 'en-US',
              modelValue: range('2026-11-22', '2026-11-24'),
              defaultValue: range('2026-11-18', '2026-11-20'),
              onValueChange,
            }}
          />
        </form>,
      );

      container.querySelector('form')!.reset();
      await wait(20);

      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputsOf(container)).toEqual(['2026-11-22', '2026-11-24']);
    });
  });

  describe('exposed actions', () => {
    it('closes the popup with `close()`, with the reason `imperative-action`', async () => {
      const onOpenChange = vi.fn();
      let root: { close(): void; unmount(): void } | undefined;
      // A ref needs a vnode that a render function makes.
      await render(() => (
        <DateRangePicker.Root
          defaultOpen
          onOpenChange={onOpenChange}
          ref={(value) => {
            root = (value as typeof root | null) ?? root;
          }}
        >
          <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
          <DateRangePicker.Portal>
            <DateRangePicker.Positioner>
              <DateRangePicker.Popup aria-label="Choose dates">Content</DateRangePicker.Popup>
            </DateRangePicker.Positioner>
          </DateRangePicker.Portal>
        </DateRangePicker.Root>
      ));
      const popup = await screen.findByRole('dialog');

      root!.close();

      await expectClosed(popup);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('imperative-action');
    });
  });
});
