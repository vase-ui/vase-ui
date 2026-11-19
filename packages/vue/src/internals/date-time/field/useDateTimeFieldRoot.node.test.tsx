import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import DateTimeFieldProbe from '../../../../test/fixtures/DateTimeFieldProbe.vue';
import { formatter } from '../format';

// A server writes an empty `value` as a bare attribute.
function segmentValues(html: string) {
  return Array.from(html.matchAll(/<input[^>]* data-type="(\w+)"[^>]*>/g), ([tag, type]) => [
    type,
    /\svalue(?:="([^"]*)")?[\s>]/.exec(tag)?.[1] ?? '',
  ]);
}

const hiddenInputOf = (html: string) =>
  /<input[^>]* aria-hidden="true"[^>]*>/.exec(html)?.[0] ?? '';

describe('the date and time field on a server', () => {
  it('has no DOM, and renders the segments of the layout with the numbers of the value', async () => {
    expect(typeof document).toBe('undefined');

    const html = await renderToString(
      <DateTimeFieldProbe defaultValue="2026-11-14T15:04" locale="de-DE" />,
    );
    const [format, epoch] = formatter(
      Temporal.PlainDateTime.from('2026-11-14T15:04'),
      { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' },
      'de-DE',
    );
    const order = format.formatToParts(epoch).flatMap(({ type }) => {
      const found = /^(year|month|day|hour|minute)$/.exec(type);
      return found ? [found[1]] : [];
    });

    expect(segmentValues(html).map(([type]) => type)).toEqual(order);
    expect(segmentValues(html)).toEqual([
      ['day', '14'],
      ['month', '11'],
      ['year', '2026'],
      ['hour', '15'],
      ['minute', '04'],
    ]);
  });

  it('writes the labels, the numbers and the hidden input into the server HTML', async () => {
    const html = await renderToString(
      <DateTimeFieldProbe defaultValue="2026-11-14" locale="en-US" name="when" required />,
    );

    expect(html).toContain('aria-label="month"');
    expect(html).toContain('aria-valuenow="11"');
    expect(html).toContain('aria-valuetext="November"');
    expect(html).toContain('aria-valuemax="30"');
    expect(html).toContain('role="group"');
    expect(hiddenInputOf(html)).toMatch(/^<input type="date" name="when"[^>]* value="2026-11-14"/);
    expect(hiddenInputOf(html)).toMatch(/ required[ >]/);
  });

  it('marks the attributes of each segment that the browser can change while it hydrates', async () => {
    const html = await renderToString(<DateTimeFieldProbe defaultValue="2026-11-14" />);

    expect(
      html.match(/<input[^>]* data-type="\w+"[^>]* data-allow-mismatch="attribute"/g),
    ).toHaveLength(3);
  });

  it('renders an empty field with placeholders, and no value in the hidden input', async () => {
    const html = await renderToString(
      <DateTimeFieldProbe locale="en-US" referenceDate="2026-11-14" />,
    );

    expect(segmentValues(html)).toEqual([
      ['month', ''],
      ['day', ''],
      ['year', ''],
    ]);
    expect(html).toContain('placeholder="yyyy"');
    expect(html).toContain('aria-valuetext="Empty"');
    expect(html).toContain('data-empty');
    expect(hiddenInputOf(html)).toMatch(/^<input type="date"[^>]*? value[\s>]/);
    expect(hiddenInputOf(html)).not.toContain('value="');
  });
});

describe('the modules of the date and time field with no Temporal', () => {
  it('load with no Temporal, because no module reads it at load', async () => {
    vi.stubGlobal('Temporal', undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    vi.resetModules();

    await expect(
      Promise.all([
        import('./segmentLayout'),
        import('./useDateTimeFieldRoot'),
        import('./useDateTimeFieldSegment'),
        import('./DateTimeFieldContext'),
      ]),
    ).resolves.toHaveLength(4);
  });
});
