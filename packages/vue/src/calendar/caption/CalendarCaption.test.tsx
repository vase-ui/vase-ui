import { describe, expect, it } from 'vitest';
import {
  createRenderer,
  describeConformance,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';
import CalendarNavigationAnatomy from '../root/CalendarNavigationAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday.
const today = () => day('2026-11-14');

function format(options: Intl.DateTimeFormatOptions, iso: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(Date.parse(iso));
}

describe('<Calendar.Caption />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.Caption />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<CalendarAncestors level="month">{node}</CalendarAncestors>),
  }));

  function renderCalendar(props: Record<string, unknown> = {}) {
    return render(<CalendarNavigationAnatomy {...{ today: today(), locale: 'en-US', ...props }} />);
  }

  const caption = () => document.querySelector<HTMLElement>('[aria-live]')!;

  it('shows the month, and names the grid of the month', async () => {
    await renderCalendar();

    const text = format({ month: 'long', year: 'numeric' }, '2026-11-14');
    expect(caption().textContent).toBe(text);
    expect(caption()).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('grid')).toHaveAttribute('aria-labelledby', caption().id);
    expect(screen.getByRole('grid')).toHaveAccessibleName(text);
  });

  it('gives the id of the consumer to the grid', async () => {
    await render(
      <CalendarAncestors level="month">
        <Calendar.Caption id="caption" />
        <Calendar.Grid />
      </CalendarAncestors>,
    );

    expect(caption().id).toBe('caption');
    expect(screen.getByRole('grid')).toHaveAttribute('aria-labelledby', 'caption');
  });

  it('shows the format of the consumer, and the default slot gets the text', async () => {
    await render(
      <CalendarAncestors level="month">
        <Calendar.Caption
          format={{ month: 'short' }}
          v-slots={{ default: ({ text }: { text: string }) => `[${text}]` }}
        />
      </CalendarAncestors>,
    );

    expect(caption().textContent).toBe(`[${format({ month: 'short' }, '2026-11-14')}]`);
  });

  it('shows the first day and the last day of a page of weeks or days', async () => {
    await renderCalendar({ visibleDuration: { weeks: 2 } });

    expect(caption().textContent).toBe(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).formatRange(Date.parse('2026-11-08'), Date.parse('2026-11-21')),
    );
  });

  it('shows the name in the locale of the calendar', async () => {
    await renderCalendar({ locale: 'fr' });

    expect(caption().textContent).toBe(
      format({ month: 'long', year: 'numeric' }, '2026-11-14', 'fr'),
    );
  });

  it('gives a new caption a change of its text after a page change, and keeps the first one', async () => {
    const { user } = await renderCalendar();
    expect(caption().textContent).toBe(format({ month: 'long', year: 'numeric' }, '2026-11-14'));

    await user.click(screen.getByTestId('next'));

    // The caption is in a new month, and its text has the mark of the mutation of a live region.
    await waitFor(() => {
      expect(caption().textContent).toContain(
        format({ month: 'long', year: 'numeric' }, '2026-12-01'),
      );
    });
    expect(caption().textContent).toMatch(/\u2060$/);
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <Calendar.Month>', async () => {
    await expect(
      render(
        <CalendarAncestors level="root">
          <Calendar.Caption />
        </CalendarAncestors>,
      ),
    ).rejects.toThrow(
      'Vase UI: A part of a month of Calendar must be inside <Calendar.Month>. Without a month the part has no weeks to show. Put the part inside <Calendar.Month>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
