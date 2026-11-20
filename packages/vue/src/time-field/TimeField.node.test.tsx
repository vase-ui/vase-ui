import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { TimeField } from '@vase-ui/vue/time-field';
import { takeReportedMessages } from '../../test/reportedMessages';
import { useTemporalPolyfill } from '../../test/temporalPolyfill';

function segmentValues(html: string) {
  return Array.from(html.matchAll(/<input[^>]* data-type="(\w+)"[^>]*>/g), ([tag, type]) => [
    type,
    /\svalue(?:="([^"]*)")?[\s>]/.exec(tag)?.[1] ?? '',
  ]);
}

const cases = () => [
  <TimeField.Root defaultValue={Temporal.PlainTime.from('15:04')} name="start">
    <TimeField.Input />
  </TimeField.Root>,
  <TimeField.Root
    defaultValue={Temporal.ZonedDateTime.from('2026-11-14T15:04[America/New_York]')}
    locale="de-DE"
  >
    <TimeField.Input />
  </TimeField.Root>,
];

describe('<TimeField.Root /> on a server', () => {
  it('has no DOM, and renders the segments, the day period and the form input of the value', async () => {
    expect(typeof document).toBe('undefined');
    const html = await renderToString(cases()[0]!);
    expect(segmentValues(html)).toEqual([
      ['hour', '3'],
      ['minute', '04'],
      ['dayPeriod', 'PM'],
    ]);
    expect(html).toMatch(/<input[^>]* type="time"[^>]* name="start"[^>]* value="15:04"/);
  });

  it('renders the name of the zone of a zoned value as a literal that a screen reader reads', async () => {
    const html = await renderToString(cases()[1]!);
    expect(html).toMatch(/<span[^>]* data-type="timeZoneName"[^>]*>GMT-5<\/span>/);
    expect(html).not.toMatch(/<span aria-hidden="true"[^>]* data-type="timeZoneName"/);
  });

  it('renders the same server HTML with a Temporal polyfill', async () => {
    const native = await Promise.all(cases().map((node) => renderToString(node)));
    useTemporalPolyfill();
    expect(await Promise.all(cases().map((node) => renderToString(node)))).toEqual(native);
  });
});

describe('the time field with no Temporal', () => {
  // A case that throws in `setup` is the last of its file.
  it('loads its entry point, and a root throws when it renders', async () => {
    vi.stubGlobal('Temporal', undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    vi.resetModules();
    const { TimeField: TimeFieldWithoutTemporal } = await import('@vase-ui/vue/time-field');
    await expect(renderToString(<TimeFieldWithoutTemporal.Root />)).rejects.toThrow(
      'Vase UI: <TimeField.Root> needs the global `Temporal`',
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
