import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { DateField } from '@vase-ui/vue/date-field';
import { takeReportedMessages } from '../../../test/reportedMessages';
import { formatter } from '../../internals/date-time/format';
import DateFieldRootHydration from './DateFieldRootHydration.test.vue';

// A server writes an empty `value` as a bare attribute.
function segmentValues(html: string) {
  return Array.from(html.matchAll(/<input[^>]* data-type="(\w+)"[^>]*>/g), ([tag, type]) => [
    type,
    /\svalue(?:="([^"]*)")?[\s>]/.exec(tag)?.[1] ?? '',
  ]);
}

const hiddenInputOf = (html: string) =>
  /<input[^>]* aria-hidden="true"[^>]*>/.exec(html)?.[0] ?? '';

describe('<DateField.Root /> on a server', () => {
  it('has no DOM, and renders the segments of the layout with the numbers of the value', async () => {
    expect(typeof document).toBe('undefined');

    const value = Temporal.PlainDate.from('2026-11-14');
    const html = await renderToString(
      <DateField.Root defaultValue={value} locale="de-DE">
        <DateField.Input />
      </DateField.Root>,
    );
    const [format, epoch] = formatter(
      value,
      { year: 'numeric', month: 'numeric', day: 'numeric' },
      'de-DE',
    );
    const order = format.formatToParts(epoch).flatMap(({ type }) => {
      const found = /^(year|month|day)$/.exec(type);
      return found ? [found[1]] : [];
    });

    expect(segmentValues(html).map(([type]) => type)).toEqual(order);
    expect(segmentValues(html)).toEqual([
      ['day', '14'],
      ['month', '11'],
      ['year', '2026'],
    ]);
  });

  it('renders the group, the names of the segments and the hidden input in the server HTML', async () => {
    const html = await renderToString(
      <DateField.Root
        defaultValue={Temporal.PlainDate.from('2026-11-14')}
        locale="en-US"
        name="when"
        required
      >
        <DateField.Input />
      </DateField.Root>,
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="month"');
    expect(html).toContain('aria-valuetext="November"');
    expect(hiddenInputOf(html)).toMatch(/^<input type="date" name="when"[^>]* value="2026-11-14"/);
    expect(hiddenInputOf(html)).toMatch(/ required[ >]/);
  });

  it('renders an empty field with placeholders and no value in the hidden input', async () => {
    const html = await renderToString(
      <DateField.Root locale="en-US" referenceDate={Temporal.PlainDate.from('2026-11-14')}>
        <DateField.Input />
      </DateField.Root>,
    );

    expect(segmentValues(html)).toEqual([
      ['month', ''],
      ['day', ''],
      ['year', ''],
    ]);
    expect(html).toContain('placeholder="yyyy"');
    expect(html).toContain('data-empty');
    expect(hiddenInputOf(html)).not.toContain('value="');
  });

  it('marks what a browser with other Intl data can change while the field hydrates', async () => {
    const html = await renderToString(
      <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')} locale="en-US">
        <DateField.Input />
      </DateField.Root>,
    );

    expect(html).toMatch(/<div[^>]* data-allow-mismatch="children"/);
    expect(
      html.match(/<input[^>]* data-type="\w+"[^>]* data-allow-mismatch="attribute"/g),
    ).toHaveLength(3);
    expect(html.match(/<span[^>]* data-allow-mismatch="text"/g)).toHaveLength(2);
  });

  // A server renders a slot that a template makes as a function that writes to its output, and a
  // slot of JSX as a function that returns its content.
  it('renders the same segments for the default parts, a slot of JSX, a slot of a template and a #render slot', async () => {
    const value = Temporal.PlainDate.from('2026-11-14');
    const withDefaults = await renderToString(
      <DateField.Root defaultValue={value} locale="en-US">
        <DateField.Input />
      </DateField.Root>,
    );
    const withJsxSlot = await renderToString(
      <DateField.Root defaultValue={value} locale="en-US">
        <DateField.Input
          v-slots={{
            segment: ({ segment }: { segment: DateField.Input.Segment }) =>
              segment.editable ? (
                <DateField.Segment segment={segment} />
              ) : (
                <DateField.Literal segment={segment} />
              ),
          }}
        />
      </DateField.Root>,
    );
    const withTemplateSlot = await renderToString(
      <DateFieldRootHydration defaultValue="2026-11-14" locale="en-US" useSegmentSlot />,
    );
    // The `children` component of a `#render` slot renders the parts as a fragment.
    const withRenderSlot = await renderToString(
      <DateFieldRootHydration defaultValue="2026-11-14" locale="en-US" useRenderSlot />,
    );

    expect(segmentValues(withDefaults)).toHaveLength(3);
    expect(segmentValues(withJsxSlot)).toEqual(segmentValues(withDefaults));
    expect(segmentValues(withTemplateSlot)).toEqual(segmentValues(withDefaults));
    expect(segmentValues(withRenderSlot)).toEqual(segmentValues(withDefaults));
  });

  it('renders a Clear button that is disabled for an empty field', async () => {
    const html = await renderToString(
      <DateField.Root locale="en-US">
        <DateField.Input />
        <DateField.Clear />
      </DateField.Root>,
    );

    const button = /<button[^>]*>(?:<!--\[-->)?x/.exec(html)?.[0] ?? '';

    expect(button).toContain(' aria-label="Clear"');
    expect(button).toMatch(/ disabled[ >]/);
  });
});

describe('<DateField.Root /> in the languages that Node.js 22 to 26 cannot format', () => {
  it.each([
    {
      name: 'a year and month in sc-IT',
      value: () => Temporal.PlainDate.from('2026-11-14'),
      props: { locale: 'sc-IT', granularity: 'month' },
      numbers: { year: 2026, month: 11 },
    },
    {
      name: 'a PlainYearMonth in ksh',
      value: () => Temporal.PlainYearMonth.from('2026-11'),
      props: { locale: 'ksh' },
      numbers: { year: 2026, month: 11 },
    },
    {
      name: 'a Persian year and month in ksh',
      value: () => Temporal.PlainDate.from('2026-11-14'),
      props: { locale: 'ksh', calendar: 'persian', granularity: 'month' },
      numbers: { year: 1405, month: 8 },
    },
    {
      name: 'a Buddhist date in my-MM',
      value: () => Temporal.PlainDate.from('2026-11-14'),
      props: { locale: 'my-MM', calendar: 'buddhist' },
      numbers: { year: 2569, month: 11, day: 14 },
    },
    {
      name: 'a zoned Japanese value in my-MM',
      value: () => Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]'),
      props: { locale: 'my-MM', calendar: 'japanese' },
      numbers: { year: 8, month: 11, day: 14 },
    },
  ] as const)('renders the year segment of $name', async ({ value, props, numbers }) => {
    const html = await renderToString(
      <DateField.Root defaultValue={value()} {...props}>
        <DateField.Input />
      </DateField.Root>,
    );
    const digits = new Intl.NumberFormat(props.locale, { useGrouping: false });
    const texts = Object.entries(numbers).map(([type, number]) => [type, digits.format(number)]);

    expect(html.match(/<input[^>]* data-type="year"/g)).toHaveLength(1);
    expect(Object.fromEntries(segmentValues(html))).toMatchObject(Object.fromEntries(texts));
  });

  // `format()` of `Intl` writes the year of the week, 2026, for this date in `my-MM`.
  it('writes the era year of a Japanese date in the year segment', async () => {
    const html = await renderToString(
      <DateField.Root
        defaultValue={Temporal.PlainDate.from('2026-11-14').withCalendar('japanese')}
        locale="my-MM"
      >
        <DateField.Input />
      </DateField.Root>,
    );

    expect(segmentValues(html).filter(([type]) => type === 'year')).toEqual([
      ['year', new Intl.NumberFormat('my-MM', { useGrouping: false }).format(8)],
    ]);
    expect(html.match(/<span[^>]* data-type="era"[^>]*>[^<]+<\/span>/g)).toHaveLength(1);
  });
});

describe('the date field with no Temporal', () => {
  // A case that throws in `setup` is the last of its file.
  it('loads its entry point, and a root throws when it renders', async () => {
    vi.stubGlobal('Temporal', undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    vi.resetModules();

    const { DateField: DateFieldWithoutTemporal } = await import('@vase-ui/vue/date-field');

    await expect(renderToString(<DateFieldWithoutTemporal.Root />)).rejects.toThrow(
      new Error(
        'Vase UI: <DateField.Root> needs the global `Temporal`, and this JavaScript engine does not have it. ' +
          'The part cannot make or compare a date without it. ' +
          'Load a Temporal polyfill, such as `temporal-polyfill/global`, before the app mounts.',
      ),
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
