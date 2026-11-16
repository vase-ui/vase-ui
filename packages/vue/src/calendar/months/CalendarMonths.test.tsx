import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  createRenderer,
  describeConformance,
  nextAnimationsRead,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';
import CalendarNavigationAnatomy from '../root/CalendarNavigationAnatomy.test.vue';

// A month leaves with an exit animation of 100 s. A test that ends the animation does it itself, so
// a late frame cannot end it before the part reads it.
const STYLE = `
  @keyframes calendar-month-leave {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  [data-index][data-ending-style] {
    animation: calendar-month-leave 100s linear;
  }
`;

const today = () => Temporal.PlainDate.from('2026-11-14');
const months = () => document.querySelectorAll<HTMLElement>('[data-index]');

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

describe('<Calendar.Months />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.Months />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<CalendarAncestors level="root">{node}</CalendarAncestors>),
  }));

  it('renders the slot month for each page, with the page and its index', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.Months
          v-slots={{
            month: ({
              month,
              index,
            }: {
              month: { yearMonth: Temporal.PlainYearMonth };
              index: number;
            }) => <span data-testid="month">{`${index}: ${month.yearMonth.toString()}`}</span>,
          }}
        />
      </CalendarAncestors>,
    );

    expect(screen.getAllByTestId('month').map((item) => item.textContent)).toEqual(['0: 2026-11']);
  });

  it('does not render the slot month in the slot render', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.Months
          v-slots={{
            month: () => <span data-testid="month" />,
            render: ({ props }: { props: Record<string, unknown> }) => (
              <section {...props} data-testid="custom" />
            ),
          }}
        />
      </CalendarAncestors>,
    );

    expect(screen.getByTestId('custom')).not.toBe(null);
    expect(screen.queryByTestId('month')).toBe(null);
  });

  describe('the direction', () => {
    it('is none until the page changes, and then the side of the change', async () => {
      const { user } = await render(
        <CalendarNavigationAnatomy {...{ today: today(), locale: 'en-US' }} />,
      );
      const root = screen.getByRole('group');
      expect(root).toHaveAttribute('data-navigation-direction', 'none');
      expect(screen.getByTestId('months')).toHaveAttribute('data-navigation-direction', 'none');

      await user.click(screen.getByTestId('next'));
      expect(root).toHaveAttribute('data-navigation-direction', 'next');
      expect(screen.getByTestId('months')).toHaveAttribute('data-navigation-direction', 'next');

      await user.click(screen.getByTestId('previous'));
      expect(root).toHaveAttribute('data-navigation-direction', 'previous');
    });
  });

  describe('a month that leaves', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    function renderCalendar(props: Record<string, unknown> = {}) {
      const style = document.createElement('style');
      style.textContent = STYLE;
      document.head.append(style);
      onTestFinished(() => {
        style.remove();
      });
      return render(
        <CalendarNavigationAnatomy {...{ today: today(), locale: 'en-US', ...props }} />,
      );
    }

    it('stays with no interaction until its animations end, and then goes', async () => {
      const { user } = await renderCalendar();
      const month = months()[0]!;
      // The part reads the animations of the first month in the frame after the mount.
      await nextFrame();

      const read = nextAnimationsRead(month, {
        action: () => user.click(screen.getByTestId('next')),
      });
      const animations = await read;

      expect(animations).toHaveLength(1);
      expect(month).toHaveAttribute('data-ending-style');
      expect(month).toHaveAttribute('inert');
      expect(month).toHaveAttribute('data-index', '-1');
      expect(month.isConnected).toBe(true);
      expect(months()).toHaveLength(2);

      for (const animation of animations) {
        animation.finish();
      }
      await Promise.all(animations.map((animation) => animation.finished));

      await waitFor(() => {
        expect(month.isConnected).toBe(false);
      });
      expect(months()).toHaveLength(1);
    });

    it('has no tab stop while it leaves, and the one tab stop is outside it', async () => {
      // 2026-11-30 is a day of November, and an outside day of the page of December.
      const { user } = await renderCalendar({
        showOutsideDays: true,
        defaultFocusedDate: Temporal.PlainDate.from('2026-11-30'),
      });
      const month = months()[0]!;
      await nextFrame();

      const animations = await nextAnimationsRead(month, {
        action: () => user.click(screen.getByTestId('next')),
      });

      expect(month).toHaveAttribute('inert');
      const stops = document.querySelectorAll('[data-date] button[tabindex="0"]');
      expect(stops).toHaveLength(1);
      expect(stops[0]!.closest('[inert]')).toBe(null);
      expect(stops[0]!.closest('[data-date]')).toHaveAttribute('data-date', '2026-11-30');

      for (const animation of animations) {
        animation.finish();
      }
      await waitFor(() => {
        expect(months()).toHaveLength(1);
      });
    });

    it('gives the month that leaves the index -1, and the month that stays its new index', async () => {
      const { user } = await renderCalendar({ numberOfMonths: 2 });
      const indexes = () => [...months()].map((month) => month.getAttribute('data-index'));
      expect(indexes()).toEqual(['0', '1']);
      // The part reads the animations of each month in the frame after the mount.
      await nextFrame();

      const animations = await nextAnimationsRead(months()[0]!, {
        action: () => user.click(screen.getByTestId('next')),
      });

      expect(indexes()).toEqual(['-1', '0', '1']);

      for (const animation of animations) {
        animation.finish();
      }
      await waitFor(() => {
        expect(indexes()).toEqual(['0', '1']);
      });
    });

    it('keeps only the page that leaves when a page of weeks moves into the next month', async () => {
      // The page of 2026-11-22 to 2026-12-05 belongs to November, and the next page to December.
      const { user, container } = await renderCalendar({
        visibleDuration: { weeks: 2 },
        defaultFocusedDate: Temporal.PlainDate.from('2026-11-25'),
      });
      const firstDays: (string | null | undefined)[] = [];
      const observer = new MutationObserver((records) => {
        for (const node of records.flatMap((record) => [...record.addedNodes])) {
          if (node instanceof Element && node.matches('[data-index]')) {
            firstDays.push(node.querySelector('[data-date]')?.getAttribute('data-date'));
          }
        }
      });
      observer.observe(container, { childList: true, subtree: true });
      onTestFinished(() => {
        observer.disconnect();
      });
      const month = months()[0]!;
      await nextFrame();

      const animations = await nextAnimationsRead(month, {
        action: () => user.click(screen.getByTestId('next')),
      });

      expect(firstDays).toEqual(['2026-12-06']);
      expect([...months()].map((item) => item.getAttribute('data-index'))).toEqual(['-1', '0']);

      for (const animation of animations) {
        animation.finish();
      }
      await waitFor(() => {
        expect(months()).toHaveLength(1);
      });
    });

    it('does not move, and keeps no month, when the runtime locale has another first day of the week', async () => {
      // The first render has the weeks of `en-US`, which start on Sunday. After the mount, the weeks
      // are those of the runtime locale, which start on Monday. That is not a move of the page.
      const DateTimeFormat = Intl.DateTimeFormat;
      const spy = vi
        .spyOn(Intl, 'DateTimeFormat')
        .mockImplementation(function MockFormat(requestedLocale, options) {
          return new DateTimeFormat(requestedLocale ?? 'fr', options);
        });
      Object.assign(Intl.DateTimeFormat, { supportedLocalesOf: DateTimeFormat.supportedLocalesOf });
      onTestFinished(() => {
        spy.mockRestore();
      });

      await renderCalendar({ locale: undefined, visibleDuration: { weeks: 2 } });
      await nextFrame();

      const headers = screen
        .getAllByRole('columnheader')
        .map((header) => header.getAttribute('abbr'));
      expect(headers[0]).toBe(
        new DateTimeFormat('fr', { weekday: 'long', timeZone: 'UTC' }).format(
          Date.parse('2026-11-09'),
        ),
      );
      expect(screen.getByRole('group')).toHaveAttribute('data-navigation-direction', 'none');
      expect(months()).toHaveLength(1);
      expect(document.querySelector('[data-ending-style], [data-starting-style]')).toBe(null);
    });

    it('goes at once when it has no animation', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
      const { user } = await renderCalendar();

      await user.click(screen.getByTestId('next'));

      await waitFor(() => {
        expect(months()).toHaveLength(1);
      });
    });

    it('does not keep a month that goes because the calendar of the grid changed', async () => {
      const { setProps } = await renderCalendar();

      await setProps({ calendar: 'persian' });

      expect(months()).toHaveLength(1);
      expect(document.querySelector('[data-ending-style]')).toBe(null);
    });

    it('gives the month that comes the starting style for a frame, and the first month none', async () => {
      const { user, container } = await renderCalendar();
      expect(document.querySelector('[data-starting-style]')).toBe(null);
      const starts: Element[] = [];
      let hasEnded = false;
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (
              node instanceof Element &&
              node.matches('[data-index]') &&
              node.hasAttribute('data-starting-style')
            ) {
              starts.push(node);
            }
          }
          if (
            record.type === 'attributes' &&
            record.target instanceof Element &&
            starts.includes(record.target) &&
            !record.target.hasAttribute('data-starting-style')
          ) {
            hasEnded = true;
          }
        }
      });
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-starting-style'],
      });
      onTestFinished(() => {
        observer.disconnect();
      });

      await user.click(screen.getByTestId('next'));

      await waitFor(() => {
        expect(hasEnded).toBe(true);
      });
      expect(starts).toHaveLength(1);
      expect(starts[0]).toHaveAttribute('data-index', '0');
    });
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <Calendar.Root>', async () => {
    await expect(render(<Calendar.Months />)).rejects.toThrow(
      'Vase UI: A part of Calendar must be inside <Calendar.Root>. Without a root the part has no days and no selection to show. Put the part inside <Calendar.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
