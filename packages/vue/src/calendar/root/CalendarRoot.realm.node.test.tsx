import { runInNewContext } from 'node:vm';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import CalendarAnatomy from './CalendarAnatomy.test.vue';

// This file does not run on the polyfill, because a value of another realm is a native value.
describe('<Calendar.Root /> with a value of another realm', () => {
  it('reads the zone and the day of the value by its kind, and not by instanceof', async () => {
    // 23:30 in UTC is 08:30 of the next day in Tokyo.
    const foreign: Temporal.ZonedDateTime = runInNewContext(
      "Temporal.ZonedDateTime.from('2026-11-14T23:30:00+00:00[UTC]').withTimeZone('Asia/Tokyo')",
    );
    expect(foreign instanceof Temporal.ZonedDateTime).toBe(false);
    const clock = vi.spyOn(Temporal.Now, 'plainDateISO');
    onTestFinished(() => {
      clock.mockRestore();
    });

    const html = await renderToString(<CalendarAnatomy {...{ locale: 'en-US', value: foreign }} />);

    expect(clock).toHaveBeenCalledWith('Asia/Tokyo');
    const cell = new RegExp(`<td[^>]* data-date="2026-11-15"[^>]*>`).exec(html)![0];
    expect(cell).toContain(' aria-selected="true"');
  });
});
