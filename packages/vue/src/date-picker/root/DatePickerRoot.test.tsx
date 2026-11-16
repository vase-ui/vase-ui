import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from '@vase-ui/vue/date-picker';
import {
  createRenderer,
  flushMicrotasks,
  popupConformanceTests,
  screen,
  waitFor,
  waitForLaterMillisecond,
  waitSingleFrame,
} from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';
import DatePickerAnatomy from './DatePickerAnatomy.test.vue';

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

interface RootInstance {
  close(): void;
  unmount(): void;
}

// A ref on a part gives its exposed members.
function createRootRef() {
  let root: RootInstance | undefined;
  return {
    ref(instance: unknown) {
      root = (instance as RootInstance | null) ?? root;
    },
    get current() {
      return root!;
    },
  };
}

describe('<DatePicker.Root />', () => {
  const { render } = createRenderer();

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
  }

  async function expectClosed() {
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null);
    });
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

    it('goes back to the trigger when Escape closes the popup, and the value stays', async () => {
      const onValueChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: day('2026-11-18'),
        onValueChange,
      });
      await open(user);
      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });

      await user.keyboard('{ArrowRight}{Escape}');

      await expectClosed();
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveFocus();
      });
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
      await open(user);

      await user.click(dayButton('2026-11-20'));

      await expectClosed();
      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('2026-11-20');
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('day-press');
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('imperative-action');
      expect(onOpenChange.mock.lastCall?.[1].event.type).toBe('click');
      expect(segmentOf(container, 'day').value).toBe('20');
      expect(hiddenInputOf(container).value).toBe('2026-11-20');
    });

    it('closes the popup after Enter on a day', async () => {
      const { user, container } = await renderPicker({ defaultValue: day('2026-11-18') });
      await open(user);
      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });

      await user.keyboard('{ArrowRight}{Enter}');

      await expectClosed();
      expect(hiddenInputOf(container).value).toBe('2026-11-19');
    });

    // The calendar emits no change for the selected day, so a rule on its events would miss it.
    it('closes the popup after a press on the selected day, and the value stays', async () => {
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const { user, container } = await renderPicker({
        defaultValue: day('2026-11-18'),
        onValueChange,
        onOpenChange,
      });
      await open(user);

      await user.click(dayButton('2026-11-18'));

      await expectClosed();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(hiddenInputOf(container).value).toBe('2026-11-18');
    });

    it('closes the popup after Enter on the selected day', async () => {
      const { user } = await renderPicker({ defaultValue: day('2026-11-18') });
      await open(user);
      await waitFor(() => {
        expect(dayButton('2026-11-18')).toHaveFocus();
      });

      await user.keyboard('{Enter}');

      await expectClosed();
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
        await open(user);

        await user.click(dayButton('2026-11-20'));

        await expectClosed();
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
        await open(user);

        await user.click(screen.getByRole('gridcell', { name: /March 2026/ }));

        await expectClosed();
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
        await open(user);

        await user.click(screen.getByRole('gridcell', { name: /November 2026/ }));

        await expectClosed();
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

    it('follows a new value of a controlled picker in the field, the calendar and the trigger', async () => {
      const { setProps, container } = await renderPicker({
        value: day('2026-11-18'),
        defaultOpen: true,
      });
      await waitFor(() => {
        expect(dayButton('2026-11-18')).not.toBe(null);
      });

      await setProps({ value: day('2026-11-20') });

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
        value: day('2026-11-18'),
        defaultOpen: true,
        'onUpdate:value': onUpdateValue,
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

    it('does not open a read-only picker', async () => {
      const { user } = await renderPicker({ defaultValue: day('2026-11-18'), readOnly: true });

      await user.click(screen.getByTestId('trigger'));

      expect(screen.queryByRole('dialog')).toBe(null);
    });
  });

  describe('exposed actions', () => {
    it('closes the popup with `close()`, with the reason `imperative-action`', async () => {
      const onOpenChange = vi.fn();
      const root = createRootRef();
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
      await waitFor(() => {
        expect(screen.getByRole('dialog')).not.toBe(null);
      });

      root.current.close();

      await expectClosed();
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('imperative-action');
    });
  });
});
