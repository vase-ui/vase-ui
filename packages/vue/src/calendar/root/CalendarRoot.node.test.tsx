import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { takeReportedMessages } from '../../../test/reportedMessages';
import CalendarAnatomy from './CalendarAnatomy.test.vue';
import CalendarRootHydration from './CalendarRootHydration.test.vue';

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday and 2026-11-01 is a Sunday.
const props = { today: '2026-11-14' };

function format(options: Intl.DateTimeFormatOptions, iso: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(Date.parse(iso));
}

interface ServerCell {
  date: string;
  attributes: string | undefined;
}

// The cells of the grid. The attributes are those of the button, or `undefined` for a cell with
// no button.
function readCells(html: string): ServerCell[] {
  return [
    ...html.matchAll(/<td[^>]* data-date="([^"]+)"[^>]*>(?:<!--[[\]]-->)*(?:<button([^>]*)>)?/g),
  ].map(([, date, attributes]) => ({ date: date!, attributes }));
}

// The start tag of the cell of a day. The order of its attributes is not part of the test.
function readTag(html: string, date: string) {
  return new RegExp(`<td[^>]* data-date="${date}"[^>]*>`).exec(html)![0];
}

function tabStops(html: string) {
  return readCells(html)
    .filter((cell) => cell.attributes?.includes(' tabindex="0"'))
    .map((cell) => cell.date);
}

describe('<Calendar.Root /> on a server', () => {
  it('renders the grid with no DOM', async () => {
    expect(typeof document).toBe('undefined');

    const html = await renderToString(<CalendarRootHydration {...props} />);

    expect(html).toMatch(/^<div[^>]* role="group"/);
    expect(html).toContain(
      ` aria-label="${format({ month: 'long', year: 'numeric' }, '2026-11-14')}"`,
    );
    expect(html).toContain(' role="grid"');
    expect(html.match(/<th /g)).toHaveLength(7);
    // November 2026 has five weeks, and the days of December have no button.
    expect(readCells(html)).toHaveLength(35);
    expect(readCells(html).filter((cell) => cell.attributes !== undefined)).toHaveLength(30);
  });

  it.each([
    { name: 'today', extra: {}, expected: ['2026-11-14'] },
    { name: 'the selected day', extra: { value: '2026-11-10' }, expected: ['2026-11-10'] },
    { name: 'the focused day', extra: { focusedDate: '2026-11-20' }, expected: ['2026-11-20'] },
    {
      name: 'the first day when today is off',
      extra: { disabledDate: '2026-11-14' },
      expected: ['2026-11-01'],
    },
    { name: 'no day when the calendar is disabled', extra: { disabled: true }, expected: [] },
  ])('writes one tab stop, on $name', async ({ extra, expected }) => {
    const html = await renderToString(<CalendarRootHydration {...props} {...extra} />);

    expect(tabStops(html)).toEqual(expected);
    expect(
      readCells(html).filter((cell) => cell.attributes?.includes(' tabindex="-1"')),
    ).toHaveLength(30 - expected.length);
  });

  it('shows the month of a focused day of another month than today, with its tab stop', async () => {
    const html = await renderToString(
      <CalendarRootHydration {...props} focusedDate="2027-02-10" />,
    );

    expect(html).toContain(
      ` aria-label="${format({ month: 'long', year: 'numeric' }, '2027-02-10')}"`,
    );
    expect(tabStops(html)).toEqual(['2027-02-10']);
  });

  it('allows the values that a browser can write another way while the part hydrates', async () => {
    const html = await renderToString(<CalendarRootHydration {...props} />);

    const buttons = html.match(/<button[^>]*>/g)!;
    expect(buttons.every((tag) => tag.includes(' data-allow-mismatch="attribute,text"'))).toBe(
      true,
    );
    const headers = html.match(/<th [^>]*>/g)!;
    expect(headers.every((tag) => tag.includes(' data-allow-mismatch="attribute,text"'))).toBe(
      true,
    );
  });

  it('writes the names, the states and the selection of the days', async () => {
    const html = await renderToString(
      <CalendarRootHydration {...props} multiple value="2026-11-10,2026-11-20" />,
    );

    const label = format(
      { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
      '2026-11-14',
    );
    expect(html).toContain(`aria-label="${label}"`);
    expect(readTag(html, '2026-11-10')).toContain(' aria-selected="true"');
    expect(readTag(html, '2026-11-20')).toContain(' aria-selected="true"');
    expect(readTag(html, '2026-11-11')).toContain(' aria-selected="false"');
    expect(readTag(html, '2026-11-14')).toContain(' data-today');
    expect(html).toContain(' aria-multiselectable="true"');
    expect(html).toContain(' aria-current="date"');
  });

  it('formats with en-US when the consumer gives no locale, and with the locale that it gives', async () => {
    const withoutLocale = await renderToString(<CalendarRootHydration {...props} />);
    const withLocale = await renderToString(<CalendarRootHydration {...props} locale="fr" />);

    expect(withoutLocale).toContain(format({ weekday: 'long' }, '2026-11-08'));
    expect(withLocale).toContain(format({ weekday: 'long' }, '2026-11-09', 'fr'));
    // The week of `fr` starts on Monday, so the grid starts a day later than the grid of `en-US`.
    expect(readCells(withLocale)[0]!.date).toBe('2026-10-26');
    expect(readCells(withoutLocale)[0]!.date).toBe('2026-11-01');
  });

  it('renders a calendar that is not Gregorian', async () => {
    const html = await renderToString(<CalendarRootHydration {...props} calendar="persian" />);

    expect(html).toContain(
      format({ month: 'long', year: 'numeric', calendar: 'persian' }, '2026-11-14'),
    );
    expect(readCells(html).filter((cell) => cell.attributes !== undefined)).toHaveLength(30);
  });

  it('writes the day of its clock to its element, and nothing with a today prop', async () => {
    const clock = vi
      .spyOn(Temporal.Now, 'plainDateISO')
      .mockReturnValue(Temporal.PlainDate.from('2026-11-14'));
    onTestFinished(() => {
      clock.mockRestore();
    });

    const html = await renderToString(
      <CalendarAnatomy {...{ locale: 'en-US', timeZone: 'Asia/Tokyo' }} />,
    );
    const withToday = await renderToString(
      <CalendarAnatomy {...{ locale: 'en-US', today: Temporal.PlainDate.from('2026-11-14') }} />,
    );

    expect(clock).toHaveBeenCalledWith('Asia/Tokyo');
    expect(/^<div[^>]* role="group"[^>]*>/.exec(html)![0]).toContain(
      ' data-vase-ui-today="2026-11-14"',
    );
    expect(withToday).not.toContain('data-vase-ui-today');
  });
});

describe('<Calendar.Root /> without Temporal', () => {
  function withoutTemporal() {
    vi.stubGlobal('Temporal', undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
  }

  it('loads the parts', async () => {
    withoutTemporal();
    vi.resetModules();

    await expect(import('../index.parts')).resolves.toBeDefined();
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws a message that names the global Temporal when it renders', async () => {
    withoutTemporal();
    vi.resetModules();
    const { Root } = await import('../index.parts');

    await expect(renderToString(<Root />)).rejects.toThrow(
      new Error(
        'Vase UI: <Calendar.Root> needs the global `Temporal`, and this JavaScript engine does not have it. ' +
          'The part cannot make or compare a date without it. ' +
          'Load a Temporal polyfill, such as `temporal-polyfill/global`, before the app mounts.',
      ),
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
