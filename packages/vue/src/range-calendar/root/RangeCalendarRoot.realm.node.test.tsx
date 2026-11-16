import { runInNewContext } from 'node:vm';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import RangeCalendarAnatomy from './RangeCalendarAnatomy.test.vue';

// This file does not run on the polyfill, because a value of another realm is a native value.
describe('<RangeCalendar.Root /> with a value of another realm', () => {
  it('reads the zone and the days of the ends by their kind, and not by instanceof', async () => {
    // 23:30 in UTC is 08:30 of the next day in Tokyo.
    const foreign = (text: string): Temporal.ZonedDateTime =>
      runInNewContext(`Temporal.ZonedDateTime.from('${text}')`);
    const start = foreign('2026-11-14T23:30:00+00:00[UTC]').withTimeZone('Asia/Tokyo');
    const end = foreign('2026-11-17T00:00:00+00:00[UTC]').withTimeZone('Asia/Tokyo');
    expect(start instanceof Temporal.ZonedDateTime).toBe(false);
    const clock = vi.spyOn(Temporal.Now, 'plainDateISO');
    onTestFinished(() => {
      clock.mockRestore();
    });

    const html = await renderToString(
      <RangeCalendarAnatomy {...{ locale: 'en-US', value: [start, end] }} />,
    );

    expect(clock).toHaveBeenCalledWith('Asia/Tokyo');
    const tag = (date: string) => new RegExp(`<td[^>]* data-date="${date}"[^>]*>`).exec(html)![0];
    expect(tag('2026-11-15')).toContain(' data-range-start');
    expect(tag('2026-11-16')).toContain(' data-range-middle');
    expect(tag('2026-11-17')).toContain(' data-range-end');
    expect(tag('2026-11-14')).toContain(' aria-selected="false"');
  });
});
