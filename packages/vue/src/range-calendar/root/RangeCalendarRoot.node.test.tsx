import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { takeReportedMessages } from '../../../test/reportedMessages';
import RangeCalendarAnatomy from './RangeCalendarAnatomy.test.vue';
import RangeCalendarRootHydration from './RangeCalendarRootHydration.test.vue';

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday and 2026-11-01 is a Sunday.
const props = { today: '2026-11-14' };

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

// The days that have the attribute, as the text of their dates.
function daysWith(html: string, attribute: string) {
  return readCells(html)
    .map(({ date }) => date)
    .filter((date) => readTag(html, date).includes(` ${attribute}`));
}

describe('<RangeCalendar.Root /> on a server', () => {
  it('renders the grid with no DOM, as a grid of more than one selection', async () => {
    expect(typeof document).toBe('undefined');

    const html = await renderToString(<RangeCalendarRootHydration {...props} />);

    expect(html).toMatch(/^<div[^>]* role="group"/);
    expect(html).toContain(' role="grid"');
    expect(html).toContain(' aria-multiselectable="true"');
    expect(readCells(html)).toHaveLength(35);
    expect(readCells(html).filter((cell) => cell.attributes !== undefined)).toHaveLength(30);
  });

  it('writes the range, its ends and the days between them', async () => {
    const html = await renderToString(
      <RangeCalendarRootHydration {...props} start="2026-11-10" end="2026-11-14" />,
    );

    expect(daysWith(html, 'data-range-start')).toEqual(['2026-11-10']);
    expect(daysWith(html, 'data-range-middle')).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
    expect(daysWith(html, 'data-range-end')).toEqual(['2026-11-14']);
    expect(readTag(html, '2026-11-12')).toContain(' aria-selected="true"');
    expect(readTag(html, '2026-11-15')).toContain(' aria-selected="false"');
    expect(html).not.toMatch(/^<div[^>]* data-selecting/);
  });

  it('writes a range in progress as a range of one day, and marks the root', async () => {
    const html = await renderToString(<RangeCalendarRootHydration {...props} start="2026-11-10" />);

    expect(html).toMatch(/^<div[^>]* data-selecting/);
    expect(daysWith(html, 'data-range-start')).toEqual(['2026-11-10']);
    expect(daysWith(html, 'data-range-end')).toEqual(['2026-11-10']);
    expect(daysWith(html, 'data-range-middle')).toEqual([]);
  });

  it.each([
    { name: 'today', extra: {}, expected: ['2026-11-14'] },
    {
      name: 'the first day of the range',
      extra: { start: '2026-11-10', end: '2026-11-12' },
      expected: ['2026-11-10'],
    },
    { name: 'the focused day', extra: { focusedDate: '2026-11-20' }, expected: ['2026-11-20'] },
    {
      name: 'the first day when today is off',
      extra: { disabledDate: '2026-11-14' },
      expected: ['2026-11-01'],
    },
    { name: 'no day when the calendar is disabled', extra: { disabled: true }, expected: [] },
  ])('writes one tab stop, on $name', async ({ extra, expected }) => {
    const html = await renderToString(<RangeCalendarRootHydration {...props} {...extra} />);

    expect(tabStops(html)).toEqual(expected);
  });

  it('stops the scroll of a finger on each day', async () => {
    const html = await renderToString(<RangeCalendarRootHydration {...props} />);

    const buttons = html.match(/<button[^>]*>/g)!;
    expect(buttons).toHaveLength(30);
    expect(buttons.every((tag) => tag.includes('touch-action:none'))).toBe(true);
  });

  it('writes the range of a calendar that is not Gregorian', async () => {
    const html = await renderToString(
      <RangeCalendarRootHydration
        {...props}
        calendar="persian"
        start="2026-11-10"
        end="2026-11-12"
      />,
    );

    expect(daysWith(html, 'data-range-start')).toEqual(['2026-11-10']);
    expect(daysWith(html, 'data-range-end')).toEqual(['2026-11-12']);
  });

  it('writes the day of its clock to its element, and nothing with a today prop', async () => {
    const clock = vi
      .spyOn(Temporal.Now, 'plainDateISO')
      .mockReturnValue(Temporal.PlainDate.from('2026-11-14'));
    onTestFinished(() => {
      clock.mockRestore();
    });

    const html = await renderToString(
      <RangeCalendarAnatomy {...{ locale: 'en-US', timeZone: 'Asia/Tokyo' }} />,
    );
    const withToday = await renderToString(
      <RangeCalendarAnatomy
        {...{ locale: 'en-US', today: Temporal.PlainDate.from('2026-11-14') }}
      />,
    );

    expect(clock).toHaveBeenCalledWith('Asia/Tokyo');
    expect(/^<div[^>]* role="group"[^>]*>/.exec(html)![0]).toContain(
      ' data-vase-ui-today="2026-11-14"',
    );
    expect(withToday).not.toContain('data-vase-ui-today');
  });
});

describe('<RangeCalendar.Root /> without Temporal', () => {
  // The polyfill file imports this file. A call of `vi.unstubAllGlobals()` would remove the
  // polyfill, so the case puts the global back.
  function withoutTemporal() {
    const temporal = globalThis.Temporal;
    vi.stubGlobal('Temporal', undefined);
    onTestFinished(() => {
      vi.stubGlobal('Temporal', temporal);
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
        'Vase UI: <RangeCalendar.Root> needs the global `Temporal`, and this JavaScript engine does not have it. ' +
          'The part cannot make or compare a date without it. ' +
          'Load a Temporal polyfill, such as `temporal-polyfill/global`, before the app mounts.',
      ),
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
