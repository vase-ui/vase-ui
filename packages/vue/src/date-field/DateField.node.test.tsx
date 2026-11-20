import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { VNode } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { DateField } from '@vase-ui/vue/date-field';
import { mockRuntimeDateTimeLocale } from '../../test/mockRuntimeLocale';
import { takeReportedMessages } from '../../test/reportedMessages';
import { useTemporalPolyfill } from '../../test/temporalPolyfill';

// A server writes an empty `value` as a bare attribute.
function segmentValues(html: string) {
  return Array.from(html.matchAll(/<input[^>]* data-type="(\w+)"[^>]*>/g), ([tag, type]) => [
    type,
    /\svalue(?:="([^"]*)")?[\s>]/.exec(tag)?.[1] ?? '',
  ]);
}

const formInputOf = (html: string) => /<input[^>]* aria-hidden="true"[^>]*>/.exec(html)?.[0] ?? '';

const nativeTemporal = globalThis.Temporal;

// Each case reads `Temporal` when it runs, so the values come from the native `Temporal` first and
// from the polyfill after `useTemporalPolyfill()`.
const SERVER_CASES: Record<string, () => VNode> = {
  'a date in de-DE': () => (
    <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')} locale="de-DE" name="when">
      <DateField.Input />
    </DateField.Root>
  ),
  'a date in the Persian calendar': () => (
    <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')} calendar="persian">
      <DateField.Input />
    </DateField.Root>
  ),
  'a date in ar-EG': () => (
    <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')} locale="ar-EG">
      <DateField.Input />
    </DateField.Root>
  ),
  'a date and time in a zone': () => (
    <DateField.Root defaultValue={Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]')}>
      <DateField.Input />
    </DateField.Root>
  ),
  'a year and month': () => (
    <DateField.Root defaultValue={Temporal.PlainYearMonth.from('2026-11')}>
      <DateField.Input />
    </DateField.Root>
  ),
  'an empty date with Clear': () => (
    <DateField.Root>
      <DateField.Input />
      <DateField.Clear aria-label="Clear">×</DateField.Clear>
    </DateField.Root>
  ),
};

async function renderServerCases() {
  const html: Record<string, string> = {};
  for (const [name, createCase] of Object.entries(SERVER_CASES)) {
    html[name] = await renderToString(createCase());
  }
  return html;
}

describe('<DateField.Root /> on a server', () => {
  it('has no DOM, and renders the segments in the order of the locale, with the numbers of the value', async () => {
    expect(typeof document).toBe('undefined');
    const html = await renderToString(SERVER_CASES['a date in de-DE']!());
    expect(segmentValues(html)).toEqual([
      ['day', '14'],
      ['month', '11'],
      ['year', '2026'],
    ]);
    expect(formInputOf(html)).toMatch(/ type="date"/);
    expect(formInputOf(html)).toMatch(/ name="when"/);
    expect(formInputOf(html)).toMatch(/ value="2026-11-14"/);
  });

  it('renders an empty field with placeholders, no value in the form input, and a disabled Clear', async () => {
    const html = await renderToString(SERVER_CASES['an empty date with Clear']!());
    expect(segmentValues(html)).toEqual([
      ['month', ''],
      ['day', ''],
      ['year', ''],
    ]);
    expect(html).toMatch(/placeholder="mo"/);
    expect(html).toMatch(/<button disabled type="button"/);
  });

  it('renders the tag of `as`, and a Clear of another tag as a button with no `type`', async () => {
    const html = await renderToString(
      <DateField.Root as="section">
        <DateField.Input as="p" />
        <DateField.Clear as="span" aria-label="Clear">
          ×
        </DateField.Clear>
      </DateField.Root>,
    );
    expect(html).toMatch(/^<section role="group"/);
    expect(html).toMatch(/<p /);
    expect(html).toMatch(/<span role="button" tabindex="-1" aria-disabled="true"/);
    expect(html).not.toMatch(/<span[^>]* type=/);
  });

  it('renders for en-US, and not for the locale of the runtime', async () => {
    mockRuntimeDateTimeLocale('de-DE');
    const html = await renderToString(
      <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')}>
        <DateField.Input />
      </DateField.Root>,
    );
    expect(segmentValues(html).map(([type]) => type)).toEqual(['month', 'day', 'year']);
  });
});

describe('<DateField.Root /> in the languages that Node.js cannot format', () => {
  it.each([
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
      name: 'a year and month in sc-IT',
      value: () => Temporal.PlainDate.from('2026-11-14'),
      props: { locale: 'sc-IT', granularity: 'month' },
      numbers: { year: 2026, month: 11 },
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
});

describe('a Temporal polyfill', () => {
  it('renders the same server HTML as the native Temporal', async () => {
    const nativeHtml = await renderServerCases();
    useTemporalPolyfill();
    expect(Temporal).not.toBe(nativeTemporal);
    expect(await renderServerCases()).toEqual(nativeHtml);
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
