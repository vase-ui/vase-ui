import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { Popover } from '@vase-ui/vue/popover';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  popupConformanceTests,
  screen,
  waitFor,
  waitForLaterMillisecond,
  waitSingleFrame,
  within,
} from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';
import { createPartRef } from '../../date-picker/root/test-utils';
import { formatText } from '../../internals/date-time/calendar/formatText';
import { pointOnFace } from '../../../test/time-clockTestUtils';
import TimePickerAnatomy from './TimePickerAnatomy.test.vue';

const time = (text: string) => Temporal.PlainTime.from(text);
const timeText = (text: string, locale = 'en-US') =>
  formatText(time(text), { hour: 'numeric', minute: '2-digit' }, locale);
const mouse = { button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse' };

// The day period of 9:00 and of 21:00.
const dayPeriodText = (hour: number, locale = 'en-US') =>
  new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' })
    .formatToParts(Date.UTC(1970, 0, 1, hour))
    .find((part) => part.type === 'dayPeriod')?.value ?? '';
const triggerName = (text: string, locale = 'en-US') =>
  `Change time, ${formatText(time(text), { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' }, locale)}`;

const hiddenInputOf = (container: Element) =>
  container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const listItem = (text: string) =>
  within(screen.getByTestId('list')).getByRole('option', { name: timeText(text) });
const columnItem = (testId: string, name: string) =>
  within(screen.getByTestId(testId)).getByRole('option', { name });

describe('<TimePicker.Root />', () => {
  const { render } = createRenderer();

  it('keeps the handle of a handle attribute closed while the picker is open', async () => {
    const handle = Popover.createHandle();
    const { user } = await renderPicker({ handle });

    await open(user);

    expect(handle.isOpen).toBe(false);
  });

  function renderPicker(props: Record<string, unknown> = {}) {
    return render(<TimePickerAnatomy {...{ locale: 'en-US', hourCycle: 12, ...props }} />);
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

  async function pressFaceAt(angle: number) {
    const face = await screen.findByTestId('face');
    await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, angle) });
    await fireEvent.pointerUp(face, { ...mouse, ...pointOnFace(face, angle) });
  }

  popupConformanceTests({
    createComponent: (props) => (
      <TimePicker.Root {...props.root}>
        <TimePicker.Trigger {...props.trigger}>Open menu</TimePicker.Trigger>
        <TimePicker.Portal {...props.portal}>
          <TimePicker.Positioner>
            <TimePicker.Popup {...props.popup}>Content</TimePicker.Popup>
          </TimePicker.Positioner>
        </TimePicker.Portal>
      </TimePicker.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'dialog',
  });

  it('renders no element of its own', async () => {
    const { container } = await render(
      <TimePicker.Root>
        <span data-testid="child" />
      </TimePicker.Root>,
    );

    expect(container.firstElementChild).toBe(screen.getByTestId('child'));
  });

  describe('the focus', () => {
    it('goes to the selected time of the list when the popup opens', async () => {
      const { user } = await renderPicker({ list: true, defaultValue: time('14:30') });

      await open(user);

      await waitFor(() => {
        expect(listItem('14:30')).toHaveFocus();
      });
    });

    it('goes to the first time of the list when the picker has no value', async () => {
      const { user } = await renderPicker({ list: true });

      await open(user);

      await waitFor(() => {
        expect(listItem('00:00')).toHaveFocus();
      });
    });

    it('scrolls the list to the selected time', async () => {
      const { user } = await renderPicker({
        list: true,
        listProps: { style: { height: '120px', overflow: 'auto' } },
        defaultValue: time('18:30'),
      });

      await open(user);

      await waitFor(() => {
        expect(listItem('18:30')).toHaveFocus();
      });
      // A fractional line height can move an edge by less than one pixel.
      const list = screen.getByTestId('list').getBoundingClientRect();
      const item = listItem('18:30').getBoundingClientRect();
      expect(item.top).toBeGreaterThanOrEqual(list.top - 1);
      expect(item.bottom).toBeLessThanOrEqual(list.bottom + 1);
    });

    it('stays on the time after the frame in which the focus manager moves the focus', async () => {
      const { user } = await renderPicker({ list: true, defaultValue: time('14:30') });

      await open(user);
      await waitFor(() => {
        expect(listItem('14:30')).toHaveFocus();
      });
      await waitSingleFrame();
      await waitSingleFrame();

      expect(listItem('14:30')).toHaveFocus();
    });

    it('goes to the selected time each time that a popup that stays mounted opens', async () => {
      const { user } = await renderPicker({
        list: true,
        defaultValue: time('14:30'),
        keepMounted: true,
      });

      await open(user);
      await waitFor(() => {
        expect(listItem('14:30')).toHaveFocus();
      });
      await user.keyboard('{ArrowDown}{Escape}');
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
      await open(user);

      await waitFor(() => {
        expect(listItem('14:30')).toHaveFocus();
      });
    });

    // A key moves the tab stop of the column, and the tab stop stays there while the popup is hidden.
    it('goes to the selected hour of a column each time that a popup that stays mounted opens', async () => {
      const { user } = await renderPicker({
        columns: true,
        defaultValue: time('15:30'),
        keepMounted: true,
      });

      await open(user);
      await waitFor(() => {
        expect(columnItem('hour-column', '3')).toHaveFocus();
      });
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(columnItem('hour-column', '4')).toHaveFocus();
      });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
      await open(user);

      await waitFor(() => {
        expect(columnItem('hour-column', '3')).toHaveFocus();
      });
    });

    it('goes to the selected hour of the first column, and not to the day period column after it', async () => {
      const { user } = await renderPicker({ columns: true, defaultValue: time('15:30') });

      await open(user);

      await waitFor(() => {
        expect(columnItem('hour-column', '3')).toHaveFocus();
      });
    });

    it('goes to the first hour in the limits of a column when the picker has no value', async () => {
      const { user } = await renderPicker({
        columns: true,
        minTime: time('09:00'),
        maxTime: time('17:00'),
      });

      await open(user);

      await waitFor(() => {
        expect(columnItem('hour-column', '9')).toHaveFocus();
      });
    });

    it('goes to the first list or column, and not to a column that comes after it', async () => {
      const { user } = await renderPicker({
        list: true,
        columns: true,
        defaultValue: time('15:30'),
      });

      await open(user);

      await waitFor(() => {
        expect(listItem('15:30')).toHaveFocus();
      });
      await waitSingleFrame();
      await waitSingleFrame();
      expect(listItem('15:30')).toHaveFocus();
    });

    it('goes to the list and not to a clock that comes after it', async () => {
      const { user } = await renderPicker({ list: true, clock: true, defaultValue: time('15:30') });

      await open(user);

      await waitFor(() => {
        expect(listItem('15:30')).toHaveFocus();
      });
      await waitSingleFrame();
      await waitSingleFrame();
      expect(listItem('15:30')).toHaveFocus();
    });

    it('goes to the face of the clock when the popup opens', async () => {
      const { user } = await renderPicker({ clock: true, defaultValue: time('15:30') });

      await open(user);

      await waitFor(() => {
        expect(screen.getByRole('slider')).toHaveFocus();
      });
    });

    describe('prop: initialFocus of the popup', () => {
      // The selected time has the focus by default, so each case shows that the value of the consumer wins.
      it('moves no focus for `false`', async () => {
        const { user } = await renderPicker({
          list: true,
          defaultValue: time('14:30'),
          popupProps: { initialFocus: false },
        });

        await open(user);
        await waitSingleFrame();
        await waitSingleFrame();

        expect(screen.getByTestId('trigger')).toHaveFocus();
      });

      // The first tabbable element of the clock is a view trigger, and the default element is the face.
      it.each([
        { name: '`true`', createOption: () => true },
        { name: '`null`', createOption: () => null },
        { name: 'an empty ref', createOption: () => shallowRef(null) },
      ])('moves the focus to the default element for $name', async ({ createOption }) => {
        const { user } = await renderPicker({
          clock: true,
          defaultValue: time('15:30'),
          popupProps: { initialFocus: createOption() },
        });

        await open(user);

        await waitFor(() => {
          expect(screen.getByRole('slider')).toHaveFocus();
        });
      });

      it('moves the focus to the element that a function gives', async () => {
        const { user } = await renderPicker({
          list: true,
          defaultValue: time('14:30'),
          popupProps: { initialFocus: () => screen.getByRole('button', { name: 'Close' }) },
        });

        await open(user);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
        });
      });
    });

    it('goes back to the trigger when Escape closes the popup, and the value stays', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({
        list: true,
        defaultValue: time('14:30'),
        onValueChange,
      });
      const popup = await open(user);
      await waitFor(() => {
        expect(listItem('14:30')).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}{Escape}');

      await expectClosed(popup);
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputOf(container).value).toBe('14:30');
    });

    it('keeps the value when a press outside closes the popup', async () => {
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const { user, container } = await renderPicker({
        list: true,
        defaultValue: time('14:30'),
        onValueChange,
        onOpenChange,
      });
      const popup = await open(user);
      await waitFor(() => {
        expect(listItem('14:30')).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}');
      await user.click(document.body);

      await expectClosed(popup);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('outside-press');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputOf(container).value).toBe('14:30');
    });

    it('goes to the selected time when Alt+Down in a segment opens the popup', async () => {
      const { user, container } = await renderPicker({ list: true, defaultValue: time('14:30') });

      segmentOf(container, 'hour').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      await waitFor(() => {
        expect(listItem('14:30')).toHaveFocus();
      });
    });
  });

  describe('the list', () => {
    it('closes the popup after a press on a time, and gives the value to the field', async () => {
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const { user, container } = await renderPicker({
        list: true,
        defaultValue: time('14:30'),
        onValueChange,
        onOpenChange,
      });
      const popup = await open(user);
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-label', triggerName('14:30'));

      await user.click(listItem('16:00'));

      await expectClosed(popup);
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-label', triggerName('16:00'));
      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('16:00:00');
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('item-press');
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('imperative-action');
      expect(hiddenInputOf(container).value).toBe('16:00');
      expect(segmentOf(container, 'hour').value).toBe('4');
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
    });

    it('closes the popup after Enter on a time', async () => {
      const { user, container } = await renderPicker({ list: true, defaultValue: time('14:30') });
      const popup = await open(user);
      await waitFor(() => {
        expect(listItem('14:30')).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}{Enter}');

      await expectClosed(popup);
      expect(hiddenInputOf(container).value).toBe('15:00');
    });

    it('closes the popup after a press on the selected time, and the value stays', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({
        list: true,
        defaultValue: time('14:30'),
        onValueChange,
      });
      const popup = await open(user);

      await user.click(listItem('14:30'));

      await expectClosed(popup);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputOf(container).value).toBe('14:30');
    });

    it('keeps the popup open when a listener cancels the change of the value', async () => {
      const { user, container } = await renderPicker({
        list: true,
        defaultValue: time('14:30'),
        onValueChange: (_value: unknown, details: { cancel: () => void }) => {
          details.cancel();
        },
      });
      await open(user);

      await user.click(listItem('16:00'));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(hiddenInputOf(container).value).toBe('14:30');
    });

    it('keeps the popup open for `closeOnSelect` set to `false`, and the press still gives the value', async () => {
      const { user, container } = await renderPicker({
        list: true,
        defaultValue: time('14:30'),
        closeOnSelect: false,
      });
      await open(user);

      await user.click(listItem('16:00'));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(hiddenInputOf(container).value).toBe('16:00');
    });

    it('keeps the popup open for a press on the selected time, for `closeOnSelect` set to `false`', async () => {
      const { user } = await renderPicker({
        list: true,
        defaultValue: time('14:30'),
        closeOnSelect: false,
      });
      await open(user);

      await user.click(listItem('14:30'));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
    });

    it('keeps the popup open when a listener cancels the close, and the value changes', async () => {
      const { user, container } = await renderPicker({
        list: true,
        defaultValue: time('14:30'),
        onOpenChange: (isOpen: boolean, details: { cancel: () => void }) => {
          if (!isOpen) {
            details.cancel();
          }
        },
      });
      await open(user);

      await user.click(listItem('16:00'));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
      expect(hiddenInputOf(container).value).toBe('16:00');
    });

    it('keeps the popup open for a press in a read-only picker', async () => {
      const { user, container } = await renderPicker({
        list: true,
        defaultValue: time('14:30'),
        defaultOpen: true,
        readOnly: true,
      });
      await waitFor(() => {
        expect(listItem('16:00')).not.toBe(null);
      });

      await user.click(listItem('16:00'));
      await user.click(listItem('14:30'));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(hiddenInputOf(container).value).toBe('14:30');
    });
  });

  describe('the columns', () => {
    it('keep the popup open after a press, and each press sets one unit', async () => {
      const { user, container } = await renderPicker({
        columns: true,
        defaultValue: time('15:30'),
      });
      await open(user);

      await user.click(columnItem('hour-column', '9'));
      await user.click(columnItem('minute-column', '45'));
      await user.click(columnItem('day-period-column', dayPeriodText(9)));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(hiddenInputOf(container).value).toBe('09:45');
    });

    it('close the popup after a press for `closeOnSelect` set to `true`', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({
        columns: true,
        defaultValue: time('15:30'),
        closeOnSelect: true,
        onValueChange,
      });
      const popup = await open(user);

      await user.click(columnItem('hour-column', '9'));

      await expectClosed(popup);
      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('21:30:00');
      expect(hiddenInputOf(container).value).toBe('21:30');
    });

    it('keep the popup open for `closeOnSelect` set to `false`', async () => {
      const { user } = await renderPicker({
        columns: true,
        defaultValue: time('15:30'),
        closeOnSelect: false,
      });
      await open(user);

      await user.click(columnItem('minute-column', '45'));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
    });
  });

  describe('the clock', () => {
    it('keeps the popup open after the commit of the hours, and closes it after the commit of the minutes', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({
        clock: true,
        defaultValue: time('15:30'),
        onValueChange,
      });
      const popup = await open(user);

      await pressFaceAt(120);
      await waitFor(() => {
        expect(screen.getByTestId('clock')).toHaveAttribute('data-view', 'minute');
      });
      expect(screen.getByRole('dialog')).not.toBe(null);

      await pressFaceAt(270);

      await expectClosed(popup);
      expect(onValueChange.mock.calls.map(([value]) => value.toString())).toEqual([
        '16:30:00',
        '16:45:00',
      ]);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('drag');
      expect(hiddenInputOf(container).value).toBe('16:45');
    });

    it('closes the popup after the commit of the hours for a granularity of hour', async () => {
      const { user } = await renderPicker({
        clock: true,
        defaultValue: time('15:30'),
        granularity: 'hour',
      });
      const popup = await open(user);

      await pressFaceAt(120);

      await expectClosed(popup);
    });

    it('closes the popup after a commit with the keyboard in the last view', async () => {
      const { user } = await renderPicker({ clock: true, defaultValue: time('15:30') });
      const popup = await open(user);
      await waitFor(() => {
        expect(screen.getByRole('slider')).toHaveFocus();
      });

      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(screen.getByTestId('clock')).toHaveAttribute('data-view', 'minute');
      });
      expect(screen.getByRole('dialog')).not.toBe(null);
      await user.keyboard('{Enter}');

      await expectClosed(popup);
    });

    it('keeps the popup open for `closeOnSelect` set to `false`', async () => {
      const { user } = await renderPicker({
        clock: true,
        defaultValue: time('15:30'),
        closeOnSelect: false,
      });
      await open(user);

      await pressFaceAt(120);
      await pressFaceAt(270);
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
    });

    it('closes the popup at the commit of the view that a consumer sets, when that view is the last', async () => {
      const { user } = await renderPicker({
        clock: true,
        defaultValue: time('15:30'),
        clockProps: { defaultView: 'minute' },
      });
      const popup = await open(user);

      await pressFaceAt(270);

      await expectClosed(popup);
    });

    it('closes the popup at the commit of the view that a consumer controls, when that view is the last', async () => {
      const { user } = await renderPicker({
        clock: true,
        defaultValue: time('15:30'),
        clockProps: { view: 'minute' },
      });
      const popup = await open(user);

      await pressFaceAt(270);

      await expectClosed(popup);
    });

    // A clock in a popup that mounts at each open starts at its first view.
    it.each([
      {
        name: 'the hours',
        granularity: 'minute',
        clockProps: {},
        firstView: 'hour',
        nextView: 'minute',
      },
      {
        name: 'the view of `defaultView`',
        granularity: 'second',
        clockProps: { defaultView: 'minute' },
        firstView: 'minute',
        nextView: 'second',
      },
    ])(
      'shows $name each time that a popup that stays mounted opens',
      async ({ granularity, clockProps, firstView, nextView }) => {
        const { user } = await renderPicker({
          clock: true,
          keepMounted: true,
          defaultValue: time('15:30'),
          granularity,
          clockProps,
        });
        await open(user);
        await pressFaceAt(120);
        await waitFor(() => {
          expect(screen.getByTestId('clock')).toHaveAttribute('data-view', nextView);
        });
        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.getByTestId('trigger')).toHaveFocus();
        });

        await open(user);

        expect(screen.getByTestId('clock')).toHaveAttribute('data-view', firstView);
      },
    );
  });

  describe('the value', () => {
    it('is one value for the field and the list: a time typed in the field is the selected time', async () => {
      const { user, container } = await renderPicker({ list: true, defaultValue: time('14:30') });

      segmentOf(container, 'hour').focus();
      await user.keyboard('{ArrowUp}');
      await open(user);

      await waitFor(() => {
        expect(listItem('15:30')).toHaveFocus();
      });
      expect(listItem('15:30')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByRole('option', { selected: true })).toHaveLength(1);
    });

    it('is one value for the list, the columns and the clock', async () => {
      const { user } = await renderPicker({
        list: true,
        columns: true,
        clock: true,
        defaultValue: time('14:30'),
        closeOnSelect: false,
      });
      await open(user);

      await user.click(listItem('16:00'));

      await waitFor(() => {
        expect(columnItem('hour-column', '4')).toHaveAttribute('aria-selected', 'true');
      });
      expect(columnItem('minute-column', '00')).toHaveAttribute('aria-selected', 'true');
      expect(columnItem('day-period-column', dayPeriodText(21))).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('slider')).toHaveValue('4');
    });

    it('follows a new value of a controlled picker in the field, the list and the trigger', async () => {
      const { setProps, container } = await renderPicker({
        list: true,
        modelValue: time('14:30'),
        defaultOpen: true,
      });
      await waitFor(() => {
        expect(listItem('14:30')).not.toBe(null);
      });

      await setProps({ modelValue: time('16:00') });

      expect(hiddenInputOf(container).value).toBe('16:00');
      expect(listItem('16:00')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-label', triggerName('16:00'));
    });

    it('does not change a controlled picker until the parent gives the new value', async () => {
      const onUpdateValue = vi.fn();
      const { user, container } = await renderPicker({
        list: true,
        modelValue: time('14:30'),
        defaultOpen: true,
        'onUpdate:modelValue': onUpdateValue,
      });
      await waitFor(() => {
        expect(listItem('16:00')).not.toBe(null);
      });

      await user.click(listItem('16:00'));

      expect(onUpdateValue.mock.lastCall?.[0].toString()).toBe('16:00:00');
      expect(hiddenInputOf(container).value).toBe('14:30');
    });
  });

  describe('prop: disabled and readOnly', () => {
    it('does not open a disabled picker, and the field ignores the user', async () => {
      const { user, container } = await renderPicker({
        defaultValue: time('14:30'),
        disabled: true,
      });

      await user.click(screen.getByTestId('trigger'));

      expect(screen.queryByRole('dialog')).toBe(null);
      expect(segmentOf(container, 'hour')).toBeDisabled();
    });

    it('is disabled by a disabled Field around it', async () => {
      const { user } = await render(
        <Field.Root disabled>
          <TimePickerAnatomy {...{ locale: 'en-US', defaultValue: time('14:30') }} />
        </Field.Root>,
      );

      await user.click(screen.getByTestId('trigger'));

      expect(screen.getByTestId('trigger')).toBeDisabled();
      expect(screen.queryByRole('dialog')).toBe(null);
    });

    it('does not open a read-only picker', async () => {
      const { user } = await renderPicker({ defaultValue: time('14:30'), readOnly: true });

      await user.click(screen.getByTestId('trigger'));

      expect(screen.queryByRole('dialog')).toBe(null);
    });
  });

  describe('VUE-112: a disabled fieldset', () => {
    // A picker that has no field reads the fieldset from its trigger.
    it.each([
      { name: 'a picker with a field', hasField: true },
      { name: 'a picker that has no field', hasField: false },
    ])('disables the trigger, the list and its items of $name', async ({ hasField }) => {
      const onValueChange = vi.fn();
      await render(() => (
        <fieldset disabled>
          <TimePicker.Root
            locale="en-US"
            hourCycle={12}
            defaultValue={time('14:30')}
            onValueChange={onValueChange}
          >
            {hasField ? (
              <TimePicker.Field>
                <TimeField.Input />
              </TimePicker.Field>
            ) : null}
            <TimePicker.Trigger data-testid="trigger">Open</TimePicker.Trigger>
            <TimePicker.List step={60} data-testid="list" />
          </TimePicker.Root>
        </fieldset>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveAttribute('data-disabled');
      });
      expect(screen.getByTestId('list')).toHaveAttribute('aria-disabled', 'true');
      expect(listItem('15:00')).toHaveAttribute('aria-disabled', 'true');

      // A person can press an item that has `aria-disabled`, so the press is real and not refused.
      await userEvent.click(listItem('15:00'), { force: true });

      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('exposed actions', () => {
    it('closes the popup with `close()`, with the reason `imperative-action`', async () => {
      const onOpenChange = vi.fn();
      const root = createPartRef<{ close(): void; unmount(): void }>();
      // A ref needs a vnode that a render function makes.
      await render(() => (
        <TimePicker.Root defaultOpen onOpenChange={onOpenChange} ref={root.ref}>
          <TimePicker.Trigger>Open</TimePicker.Trigger>
          <TimePicker.Portal>
            <TimePicker.Positioner>
              <TimePicker.Popup aria-label="Choose time">Content</TimePicker.Popup>
            </TimePicker.Positioner>
          </TimePicker.Portal>
        </TimePicker.Root>
      ));
      const popup = await screen.findByRole('dialog');

      root.current.close();

      await expectClosed(popup);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('imperative-action');
    });
  });
});
