import { onTestFinished, vi } from 'vitest';

/**
 * Makes `Temporal.Now.plainDateISO` give another day than today, for the rest of the test, and
 * returns that day. The day differs from today in the day only, in the month, or in the year.
 *
 * Call it after `renderOnServer`, because the server render reads the clock of Node. The day is two
 * days, months or years away from today. It thus differs from the day of the server also when
 * midnight comes between the two reads, or when Node and the browser have other time zones.
 */
export function mockBrowserToday(distance: 'day' | 'month' | 'year'): Temporal.PlainDate {
  const real = Temporal.Now.plainDateISO();
  let browserDay: Temporal.PlainDate;
  if (distance === 'day') {
    browserDay =
      real.day <= real.daysInMonth - 2 ? real.add({ days: 2 }) : real.subtract({ days: 2 });
  } else {
    browserDay = real.add(distance === 'month' ? { months: 2 } : { years: 2 });
  }
  const spy = vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(browserDay);
  onTestFinished(() => {
    spy.mockRestore();
  });
  return browserDay;
}
