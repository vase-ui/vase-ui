import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Popover } from '@vase-ui/vue/popover';
import { Field } from '@vase-ui/vue/field';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  popupConformanceTests,
  screen,
  takeReportedMessages,
  waitFor,
  waitForLaterMillisecond,
  waitSingleFrame,
} from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';
import DatePickerAnatomy from './DatePickerAnatomy.test.vue';
import { createPartRef } from '../../../test/date-pickerTestUtils';

const day = (text: string) => Temporal.PlainDate.from(text);
const today = () => day('2026-11-14');

const dayButton = (iso: string) =>
  document.querySelector<HTMLElement>(`[data-date="${iso}"] button`)!;
const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const hiddenInputOf = (container: Element) =>
  container.querySelector<HTMLInputElement>('input[aria-hidden]')!;
const selectedCells = () =>
  screen.getAllByRole('gridcell').filter((cell) => cell.getAttribute('aria-selected') === 'true');

describe('<DatePicker.Root />', () => {
  const { render } = createRenderer();

  it('keeps the handle of a handle attribute closed while the picker is open', async () => {
    const handle = Popover.createHandle();
    const { user } = await renderPicker({ handle });

    await open(user);

    expect(handle.isOpen).toBe(false);
  });

  it('reports a class attribute that no element of the root takes', async () => {
    await render(
      <DatePicker.Root class="picker">
        <span />
      </DatePicker.Root>,
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Extraneous non-props attributes (class)'),
    ]);
  });

  function renderPicker(props: Record<string, unknown> = {}) {
    return render(
      <DatePickerAnatomy
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
      <DatePicker.Root {...props.root}>
        <DatePicker.Trigger {...props.trigger}>Open menu</DatePicker.Trigger>
        <DatePicker.Portal {...props.portal}>
          <DatePicker.Positioner>
            <DatePicker.Popup {...props.popup}>Content</DatePicker.Popup>
          </DatePicker.Positioner>
        </DatePicker.Portal>
      </DatePicker.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'dialog',
  });

  it('renders no element of its own', async () => {
    const { container } = await render(
      <DatePicker.Root>
        <span data-testid="child" />
      </DatePicker.Root>,
    );

    expect(container.firstElementChild).toBe(screen.getByTestId('child'));
  });

  describe('the focus', () => {
    it('goes to the day that has the tab stop when the popup opens: the selected day', async () => {
      const { user } = await renderPicker({ defaultValue: day('2026-11-18') });

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

    it('stays on the day after the frame in which the focus manager moves the focus', async () => {
      const { user } = await renderPicker({ defaultValue: day('2026-11-18') });

      await open(user);
      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });
      await waitSingleFrame();
      await waitSingleFrame();

      expect(dayButton('2026-11-18')).toHaveFocus();
    });

    it('goes to the day each time that a popup that stays mounted opens', async () => {
      const { user } = await renderPicker({ defaultValue: day('2026-11-18'), keepMounted: true });

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

    describe('prop: initialFocus of the popup', () => {
      // The day has the focus by default, so each case shows that the value of the consumer wins.
      it('moves no focus for `false`', async () => {
        const { user } = await renderPicker({
          defaultValue: day('2026-11-18'),
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
          defaultValue: day('2026-11-18'),
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
            defaultValue: day('2026-11-18'),
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
          defaultValue: day('2026-11-18'),
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
        defaultValue: day('2026-11-18'),
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
      expect(hiddenInputOf(container).value).toBe('2026-11-18');
    });

    it('keeps the value when a press outside closes the popup', async () => {
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: day('2026-11-18'),
        onValueChange,
        onOpenChange,
      });
      const popup = await open(user);
      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });

      await user.keyboard('{ArrowRight}');
      await user.click(document.body);

      await expectClosed(popup);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('outside-press');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputOf(container).value).toBe('2026-11-18');
    });

    it('goes to the day when Alt+Down in a segment opens the popup', async () => {
      const { user } = await renderPicker({ defaultValue: day('2026-11-18') });

      screen.getAllByRole('spinbutton')[0]!.focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });
    });
  });

  describe('the selection', () => {
    it('closes the popup after a press on a new day, and gives the value to the field', async () => {
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: day('2026-11-18'),
        onValueChange,
        onOpenChange,
      });
      const popup = await open(user);

      await user.click(dayButton('2026-11-20'));

      await expectClosed(popup);
      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('2026-11-20');
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('day-press');
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('imperative-action');
      expect(onOpenChange.mock.lastCall?.[1].event.type).toBe('click');
      expect(segmentOf(container, 'day').value).toBe('20');
      expect(hiddenInputOf(container).value).toBe('2026-11-20');
    });

    // The close after a selection goes through the store of the popover, as each other close does.
    it('lets a listener keep the popup mounted after a selection, until `unmount()`', async () => {
      const fixture = createPartRef<{ root: { unmount(): void } }>();
      const { user } = await render(() => (
        <DatePickerAnatomy
          ref={fixture.ref}
          {...{
            defaultValue: day('2026-11-18'),
            locale: 'en-US',
            calendarProps: { today: today() },
            onOpenChange: (isOpen: boolean, details: { preventUnmountOnClose(): void }) => {
              if (!isOpen) {
                details.preventUnmountOnClose();
              }
            },
          }}
        />
      ));
      const popup = await open(user);

      await user.click(dayButton('2026-11-20'));
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
      });
      await waitSingleFrame();
      await waitSingleFrame();

      expect(popup).toBeInTheDocument();

      fixture.current.root.unmount();

      await expectClosed(popup);
    });

    it('closes the popup after Enter on a day', async () => {
      const { user, container } = await renderPicker({ defaultValue: day('2026-11-18') });
      const popup = await open(user);
      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });

      await user.keyboard('{ArrowRight}{Enter}');

      await expectClosed(popup);
      expect(hiddenInputOf(container).value).toBe('2026-11-19');
      // The focus goes back to the trigger, as the date picker dialog pattern says.
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
    });

    it('closes the popup after a press on the selected day, and the value stays', async () => {
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: day('2026-11-18'),
        onValueChange,
        onOpenChange,
      });
      const popup = await open(user);

      await user.click(dayButton('2026-11-18'));

      await expectClosed(popup);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(hiddenInputOf(container).value).toBe('2026-11-18');
    });

    it('closes the popup after Enter on the selected day', async () => {
      const { user } = await renderPicker({ defaultValue: day('2026-11-18') });
      const popup = await open(user);
      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });

      await user.keyboard('{Enter}');

      await expectClosed(popup);
    });

    it('keeps the popup open when a listener cancels the change of the value', async () => {
      const { user, container } = await renderPicker({
        defaultValue: day('2026-11-18'),
        onValueChange: (_value: unknown, details: { cancel: () => void }) => {
          details.cancel();
        },
      });
      await open(user);

      await user.click(dayButton('2026-11-20'));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(hiddenInputOf(container).value).toBe('2026-11-18');
    });

    it('keeps the popup open when a listener cancels the close, and the value changes', async () => {
      const { user, container } = await renderPicker({
        defaultValue: day('2026-11-18'),
        onOpenChange: (open: boolean, details: { cancel: () => void }) => {
          if (!open) {
            details.cancel();
          }
        },
      });
      await open(user);

      await user.click(dayButton('2026-11-20'));
      await flushMicrotasks();

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
      expect(hiddenInputOf(container).value).toBe('2026-11-20');
    });

    describe('prop: closeOnSelect', () => {
      it('keeps the popup open for `false`, and the press still gives the value', async () => {
        const { user, container } = await renderPicker({
          defaultValue: day('2026-11-18'),
          closeOnSelect: false,
        });
        await open(user);

        await user.click(dayButton('2026-11-20'));
        await flushMicrotasks();

        expect(screen.getByRole('dialog')).not.toBe(null);
        expect(hiddenInputOf(container).value).toBe('2026-11-20');
      });

      it('keeps the popup open for a press on the selected day, for `false`', async () => {
        const { user } = await renderPicker({
          defaultValue: day('2026-11-18'),
          closeOnSelect: false,
        });
        await open(user);

        await user.click(dayButton('2026-11-18'));
        await flushMicrotasks();

        expect(screen.getByRole('dialog')).not.toBe(null);
      });

      it('is `false` by default for a value with a time', async () => {
        const { user, container } = await renderPicker({
          defaultValue: Temporal.PlainDateTime.from('2026-11-18T09:30'),
        });
        await open(user);

        await user.click(dayButton('2026-11-20'));
        await flushMicrotasks();

        expect(screen.getByRole('dialog')).not.toBe(null);
        expect(hiddenInputOf(container).value).toBe('2026-11-20T09:30');
      });

      it('is `false` by default for a granularity with a time, with no value', async () => {
        const { user } = await renderPicker({ granularity: 'minute' });
        await open(user);

        await user.click(dayButton('2026-11-20'));
        await flushMicrotasks();

        expect(screen.getByRole('dialog')).not.toBe(null);
      });

      it('closes the popup for `true`, also for a value with a time', async () => {
        const { user } = await renderPicker({
          defaultValue: Temporal.PlainDateTime.from('2026-11-18T09:30'),
          closeOnSelect: true,
        });
        const popup = await open(user);

        await user.click(dayButton('2026-11-20'));

        await expectClosed(popup);
      });
    });

    describe('a press on a day that cannot be selected', () => {
      it('keeps the popup open for an unavailable day', async () => {
        const { user, container } = await renderPicker({
          defaultValue: day('2026-11-18'),
          unavailableDates: day('2026-11-20'),
        });
        await open(user);

        await user.click(dayButton('2026-11-20'));
        await flushMicrotasks();

        expect(screen.getByRole('dialog')).not.toBe(null);
        expect(hiddenInputOf(container).value).toBe('2026-11-18');
      });

      it('keeps the popup open for each press in a read-only picker', async () => {
        const { user, container } = await renderPicker({
          defaultValue: day('2026-11-18'),
          defaultOpen: true,
          readOnly: true,
        });
        await waitFor(() => {
          expect(dayButton('2026-11-20')).not.toBe(null);
        });

        await user.click(dayButton('2026-11-20'));
        await user.click(dayButton('2026-11-18'));
        await flushMicrotasks();

        expect(screen.getByRole('dialog')).not.toBe(null);
        expect(hiddenInputOf(container).value).toBe('2026-11-18');
      });
    });

    describe('a month picker', () => {
      const month = Temporal.PlainYearMonth.from('2026-11');

      it('closes the popup after a press on a month', async () => {
        const onValueChange = vi.fn();
        const { user, container } = await renderPicker({
          defaultValue: month,
          monthGrid: true,
          onValueChange,
        });
        const popup = await open(user);

        await user.click(screen.getByRole('gridcell', { name: /March 2026/ }));

        await expectClosed(popup);
        expect(onValueChange.mock.lastCall?.[0].toString()).toBe('2026-03');
        expect(onValueChange.mock.lastCall?.[1].reason).toBe('month-press');
        expect(hiddenInputOf(container).value).toBe('2026-03');
      });

      it('closes the popup after a press on the selected month', async () => {
        const onValueChange = vi.fn();
        const { user } = await renderPicker({
          defaultValue: month,
          monthGrid: true,
          onValueChange,
        });
        const popup = await open(user);

        await user.click(screen.getByRole('gridcell', { name: /November 2026/ }));

        await expectClosed(popup);
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('focuses the selected month when the popup opens', async () => {
        const { user } = await renderPicker({ defaultValue: month, monthGrid: true });

        await open(user);

        await waitFor(() => {
          expect(screen.getByRole('gridcell', { name: /November 2026/ })).toHaveFocus();
        });
      });
    });
  });

  describe('the value', () => {
    it('is one value for the field and the calendar: a day typed in the field is the selected day', async () => {
      const { user, container } = await renderPicker({ defaultValue: day('2026-11-18') });

      segmentOf(container, 'day').focus();
      await user.keyboard('{ArrowUp}');
      await open(user);

      await waitFor(() => {
        expect(dayButton('2026-11-19')).toHaveFocus();
      });
      expect(dayButton('2026-11-19').closest('[data-date]')).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(selectedCells()).toHaveLength(1);
    });

    it('commits composed text once to the open calendar and the form', async () => {
      const update = vi.fn();
      const { container } = await render(
        <form data-testid="form">
          <DatePickerAnatomy
            open
            name="day"
            defaultValue={day('2026-11-18')}
            locale="en-US"
            popupProps={{ initialFocus: false }}
            onUpdate:modelValue={update}
          />
        </form>,
      );
      const popup = await screen.findByRole('dialog');
      const form = screen.getByTestId<HTMLFormElement>('form');
      const input = segmentOf(container, 'day');
      input.focus();
      await fireEvent.compositionStart(input);
      await fireEvent.input(input, { target: { value: '2' } });
      await fireEvent.input(input, { target: { value: '23' } });

      expect(update).not.toHaveBeenCalled();
      expect(new FormData(form).get('day')).toBe('2026-11-18');
      expect(selectedCells()).toEqual([dayButton('2026-11-18').closest('[data-date]')]);

      await fireEvent.compositionEnd(input, { data: '23' });

      expect(update).toHaveBeenCalledTimes(1);
      expect(new FormData(form).get('day')).toBe('2026-11-23');
      expect(selectedCells()).toEqual([dayButton('2026-11-23').closest('[data-date]')]);
      expect(screen.getByRole('dialog')).toBe(popup);
    });

    it('follows a new value of a controlled picker in the field, the calendar and the trigger', async () => {
      const { setProps, container } = await renderPicker({
        modelValue: day('2026-11-18'),
        defaultOpen: true,
      });
      await waitFor(() => {
        expect(dayButton('2026-11-18')).not.toBe(null);
      });

      await setProps({ modelValue: day('2026-11-20') });

      expect(segmentOf(container, 'day').value).toBe('20');
      expect(dayButton('2026-11-20').closest('[data-date]')).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByTestId('trigger').getAttribute('aria-label')).toContain('November 20');
    });

    it('does not change a controlled picker until the parent gives the new value', async () => {
      const onUpdateValue = vi.fn();
      const { user, container } = await renderPicker({
        modelValue: day('2026-11-18'),
        defaultOpen: true,
        'onUpdate:modelValue': onUpdateValue,
      });
      await waitFor(() => {
        expect(dayButton('2026-11-20')).not.toBe(null);
      });

      await user.click(dayButton('2026-11-20'));

      expect(onUpdateValue.mock.lastCall?.[0].toString()).toBe('2026-11-20');
      expect(hiddenInputOf(container).value).toBe('2026-11-18');
    });
  });

  describe('prop: disabled and readOnly', () => {
    it('does not open a disabled picker, and the field and the calendar ignore the user', async () => {
      const { user, container } = await renderPicker({
        defaultValue: day('2026-11-18'),
        disabled: true,
      });

      await user.click(screen.getByTestId('trigger'));

      expect(screen.queryByRole('dialog')).toBe(null);
      expect(segmentOf(container, 'day')).toBeDisabled();
    });

    it('is disabled by a disabled Field around it', async () => {
      const { user } = await render(
        <Field.Root disabled>
          <DatePickerAnatomy {...{ locale: 'en-US', defaultValue: day('2026-11-18') }} />
        </Field.Root>,
      );

      await user.click(screen.getByTestId('trigger'));

      expect(screen.getByTestId('trigger')).toBeDisabled();
      expect(screen.queryByRole('dialog')).toBe(null);
    });

    it('does not open a read-only picker', async () => {
      const { user } = await renderPicker({ defaultValue: day('2026-11-18'), readOnly: true });

      await user.click(screen.getByTestId('trigger'));

      expect(screen.queryByRole('dialog')).toBe(null);
    });

    describe('VUE-112: a disabled fieldset', () => {
      // A picker that has no field reads the fieldset from its trigger.
      it.each([
        { name: 'a picker with a field', hasField: true },
        { name: 'a picker that has no field', hasField: false },
      ])('disables the trigger and, in its portal, the calendar of $name', async ({ hasField }) => {
        const onValueChange = vi.fn();
        const { user } = await render(() => (
          <fieldset disabled>
            <DatePickerAnatomy
              {...{
                locale: 'en-US',
                defaultValue: day('2026-11-18'),
                open: true,
                hasField,
                calendarProps: { today: today() },
                onValueChange,
              }}
            />
          </fieldset>
        ));

        // The popup is in a portal and out of the fieldset, so the picker gives the state to it.
        expect(await screen.findByTestId('calendar')).toHaveAttribute('data-disabled');
        expect(screen.getByTestId('trigger')).toHaveAttribute('data-disabled');

        await user.click(dayButton('2026-11-20'));

        expect(onValueChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('exposed actions', () => {
    it('closes the popup with `close()`, with the reason `imperative-action`', async () => {
      const onOpenChange = vi.fn();
      const root = createPartRef<{ close(): void; unmount(): void }>();
      // A ref needs a vnode that a render function makes.
      await render(() => (
        <DatePicker.Root defaultOpen onOpenChange={onOpenChange} ref={root.ref}>
          <DatePicker.Trigger>Open</DatePicker.Trigger>
          <DatePicker.Portal>
            <DatePicker.Positioner>
              <DatePicker.Popup aria-label="Choose date">Content</DatePicker.Popup>
            </DatePicker.Positioner>
          </DatePicker.Portal>
        </DatePicker.Root>
      ));
      const popup = await screen.findByRole('dialog');

      root.current.close();

      await expectClosed(popup);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('imperative-action');
    });
  });
});
