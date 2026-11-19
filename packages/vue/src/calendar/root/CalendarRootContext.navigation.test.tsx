import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import CalendarNavigationAnatomy from './CalendarNavigationAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday.
const today = () => day('2026-11-14');

function format(options: Intl.DateTimeFormatOptions, iso: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(Date.parse(iso));
}

const monthName = (iso: string) => format({ month: 'long', year: 'numeric' }, iso);

// The names of the months that the captions show, in the order of the grids.
function captions() {
  return screen.getAllByRole('grid').map((grid) => grid.getAttribute('aria-label'));
}

async function advance(milliseconds: number) {
  vi.advanceTimersByTime(milliseconds);
  await flushMicrotasks();
}

const START_DELAY = 400;
const TICK_DELAY = 60;

describe.each([
  { name: 'previous', testId: 'previous', label: 'Previous month', step: -1 },
  { name: 'next', testId: 'next', label: 'Next month', step: 1 },
])('the $name button of a calendar', ({ testId, label, step }) => {
  const { render } = createRenderer();

  function renderCalendar(props: Record<string, unknown> = {}) {
    return render(<CalendarNavigationAnatomy {...{ today: today(), locale: 'en-US', ...props }} />);
  }

  const month = (offset: number) => monthName(day('2026-11-01').add({ months: offset }).toString());

  describe('a press', () => {
    it('is named by what it moves', async () => {
      await renderCalendar();

      expect(screen.getByTestId(testId)).toHaveAccessibleName(label);
    });

    it('moves the page by one month, and gives the change its reason and its event', async () => {
      const onMonthChange = vi.fn();
      const { user } = await renderCalendar({ onMonthChange });

      await user.click(screen.getByTestId(testId));

      expect(captions()).toEqual([month(step)]);
      expect(onMonthChange).toHaveBeenCalledTimes(1);
      const [value, details] = onMonthChange.mock.calls[0]!;
      expect(value.toString()).toBe(`2026-${11 + step}`);
      expect(details.reason).toBe('month-change');
      expect(details.event).toBeInstanceOf(MouseEvent);
    });

    it('moves the page with the keyboard, and keeps the focus on the button', async () => {
      const { user } = await renderCalendar();
      const button = screen.getByTestId(testId);
      button.focus();

      await user.keyboard('{Enter}');
      await user.keyboard(' ');

      expect(captions()).toEqual([month(step * 2)]);
      expect(button).toHaveFocus();
    });

    it('keeps the page when a listener cancels the change', async () => {
      const onMonthChange = vi.fn((_month: unknown, details: { cancel: () => void }) => {
        details.cancel();
      });
      const { user } = await renderCalendar({ onMonthChange });

      await user.click(screen.getByTestId(testId));

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      expect(captions()).toEqual([month(0)]);
    });

    it('moves a read-only calendar, and not a disabled one', async () => {
      const { user, setProps } = await renderCalendar({ readOnly: true });

      await user.click(screen.getByTestId(testId));
      expect(captions()).toEqual([month(step)]);

      await setProps({ readOnly: false, disabled: true });

      expect(screen.getByTestId(testId)).toBeDisabled();
      expect(screen.getByTestId(testId)).toHaveAttribute('data-disabled');
    });
  });

  describe('the limits', () => {
    // The previous button is at its limit on the first day of the month, and the next one on the last.
    const limits = step === -1 ? { minDate: day('2026-11-01') } : { maxDate: day('2026-11-30') };

    it('is unavailable at the limit, and keeps its focus', async () => {
      const onMonthChange = vi.fn();
      const { user } = await renderCalendar({ ...limits, onMonthChange });
      const button = screen.getByTestId(testId);
      button.focus();

      await user.keyboard('{Enter}');

      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).not.toBeDisabled();
      expect(button).toHaveFocus();
      expect(onMonthChange).not.toHaveBeenCalled();
      expect(captions()).toEqual([month(0)]);
    });

    it('moves to a month that has a day that the user can reach, and then stops', async () => {
      const edge = step === -1 ? { minDate: day('2026-10-31') } : { maxDate: day('2026-12-01') };
      const { user } = await renderCalendar(edge);
      const button = screen.getByTestId(testId);
      expect(button).toHaveAttribute('aria-disabled', 'false');

      await user.click(button);

      expect(captions()).toEqual([month(step)]);
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('a hold', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('moves at the press, and then at each tick until the release', async () => {
      await renderCalendar();
      const button = screen.getByTestId(testId);

      await fireEvent.pointerDown(button, { pointerType: 'mouse' });
      expect(captions()).toEqual([month(step)]);

      await advance(START_DELAY + TICK_DELAY);
      expect(captions()).toEqual([month(step * 2)]);

      await advance(TICK_DELAY);
      expect(captions()).toEqual([month(step * 3)]);

      await fireEvent.pointerUp(button, { pointerType: 'mouse' });
      await advance(START_DELAY * 2);
      expect(captions()).toEqual([month(step * 3)]);
    });

    it('stops at the limit, and does not move again after it', async () => {
      const limit = step === -1 ? { minDate: day('2026-09-15') } : { maxDate: day('2027-01-15') };
      await renderCalendar(limit);
      const button = screen.getByTestId(testId);

      await fireEvent.pointerDown(button, { pointerType: 'mouse' });
      await advance(START_DELAY + TICK_DELAY);
      await advance(TICK_DELAY * 4);

      expect(captions()).toEqual([month(step * 2)]);
      expect(button).toHaveAttribute('aria-disabled', 'true');
      await fireEvent.pointerUp(button, { pointerType: 'mouse' });
    });
  });

  it('is named by the count of months that a press moves with pagedNavigation', async () => {
    await renderCalendar({ numberOfMonths: 2, pagedNavigation: true });

    expect(screen.getByTestId(testId)).toHaveAccessibleName(label.replace('month', '2 months'));
  });
});
