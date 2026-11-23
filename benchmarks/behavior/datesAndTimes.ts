import type { Page } from 'playwright';
import { readAfterInput } from './layers.ts';
import type { CaseResult, Group } from './types.ts';

const CALENDAR = 'calendar';
const HEADING = 'calendar-heading';
const DATE_FIELD = 'date-field';
const TIME_FIELD = 'time-field';
/** The day of the value of the calendar, 2026-01-31. */
const SELECTED_DAY = '31';
/** The most Tab presses to a part: the buttons before a grid and the 31 days of a grid of buttons. */
const TAB_LIMIT = 40;
/** 2026-03-08 03:30 in New York. Daylight time starts at 02:00 that day, so 02:30 does not exist. */
const INSTANT_AFTER_GAP = Date.UTC(2026, 2, 8, 7, 30);
/** The days of the week in the sequence of `Date#getUTCDay`. */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const APG_DATE_PICKER = {
  text: 'WAI-ARIA APG, Date Picker Dialog Example',
  url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/',
};
const APG_SPINBUTTON = {
  text: 'WAI-ARIA APG, Spinbutton Pattern',
  url: 'https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/',
};

function result(pass: boolean, measure: string, reason = measure): CaseResult {
  return pass ? { verdict: 'pass', measure } : { verdict: 'fail', measure, reason };
}

/**
 * The text that the focused element shows two frames after an input, and whether the element is in
 * the element of a marker.
 */
async function focusAfterInput(
  page: Page,
  marker: string,
): Promise<{ inside: boolean; text: string }> {
  await readAfterInput(page, []);
  return page.evaluate((container) => {
    const element = document.querySelector(`[data-bench="${container}"]`);
    const active = document.activeElement;
    const text = active instanceof HTMLInputElement ? active.value : (active?.textContent ?? '');
    return {
      inside: element !== null && active !== null && active !== element && element.contains(active),
      text: text.replace(/\s+/g, ' ').trim(),
    };
  }, marker);
}

/** The text of the focused day, or `outside the calendar`. */
async function focusedDay(page: Page): Promise<string> {
  const { inside, text } = await focusAfterInput(page, CALENDAR);
  return inside ? text : 'outside the calendar';
}

/**
 * Presses Tab until the focus is in the element of a marker and `isTarget` holds for the text of
 * the focused element. Returns `false` after `TAB_LIMIT` presses.
 */
async function tabTo(
  page: Page,
  marker: string,
  isTarget: (text: string) => boolean = () => true,
): Promise<boolean> {
  for (let press = 0; press < TAB_LIMIT; press++) {
    await page.keyboard.press('Tab');
    const { inside, text } = await focusAfterInput(page, marker);
    if (inside && isTarget(text)) {
      return true;
    }
  }
  return false;
}

const NO_TAB_TO_DAY = `${String(TAB_LIMIT)} Tab presses do not reach January ${SELECTED_DAY}.`;
const NO_TAB_TO_FIELD = `${String(TAB_LIMIT)} Tab presses do not reach the field.`;

/**
 * Presses Tab to the selected day, then presses each key of the steps and reads the page after it.
 * Passes when each read gives the text of its step.
 */
async function keysFromSelectedDay(
  page: Page,
  steps: readonly (readonly [key: string, expected: string])[],
  readPage: (page: Page) => Promise<string>,
): Promise<CaseResult> {
  if (!(await tabTo(page, CALENDAR, (text) => text === SELECTED_DAY))) {
    return result(false, NO_TAB_TO_DAY);
  }
  const texts: string[] = [];
  for (const [key] of steps) {
    await page.keyboard.press(key);
    texts.push(await readPage(page));
  }
  return result(
    steps.every(([, expected], index) => texts[index] === expected),
    steps.map(([key], index) => `${key}: ${texts[index] ?? ''}.`).join(' '),
  );
}

async function headingText(page: Page): Promise<string> {
  await readAfterInput(page, []);
  const text = await page.locator(`[data-bench="${HEADING}"]`).first().textContent();
  return text?.replace(/\s+/g, ' ').trim() ?? 'none';
}

/** Where the cells of a calendar with no grid are. */
async function cellsWithNoGrid(page: Page): Promise<string> {
  return page.locator(`[data-bench="${CALENDAR}"]`).evaluate((calendar) => {
    const cell = calendar.querySelector('[role="gridcell"], td');
    if (cell === null) {
      return 'No element has the role gridcell.';
    }
    const holder = cell.closest(
      'table, [role]:not([role="row"], [role="rowgroup"], [role="gridcell"])',
    );
    return holder === null
      ? 'The cells are in no element with a role.'
      : `The cells are in an element with the role ${holder.getAttribute('role') ?? 'table'}.`;
  });
}

async function gridRoles(page: Page): Promise<CaseResult> {
  const grid = page.locator(`[data-bench="${CALENDAR}"]`).getByRole('grid').first();
  if ((await grid.count()) === 0) {
    const measure = `No grid. ${await cellsWithNoGrid(page)}`;
    return result(false, measure, 'No element has the role grid.');
  }
  const [line = ''] = (await grid.ariaSnapshot()).split('\n');
  const name = /^- grid "(.*)"/.exec(line)?.[1] ?? '';
  const selected = (await grid.getByRole('gridcell', { selected: true }).allTextContents()).map(
    (text) => text.trim(),
  );
  const tabStops = await grid.evaluate((element) =>
    Array.from(element.querySelectorAll<HTMLElement>('*'))
      .filter((item) => item.tabIndex >= 0 && !item.matches(':disabled') && item.checkVisibility())
      .map((item) => item.textContent.trim()),
  );
  const list = (items: readonly string[]) => (items.length === 0 ? 'none' : items.join(', '));
  const measure = `Name: ${name || 'none'}. Selected: ${list(selected)}. In the Tab sequence: ${list(tabStops)}.`;
  return result(name !== '' && selected.length === 1 && tabStops.length === 1, measure);
}

/**
 * The first day of the week of a calendar that shows January 2026: the first of the days 1 to 7
 * whose row is not the row of the day before. A row is an element with the role row, a `tr`, or
 * else the parent of the day.
 */
async function weekStart(page: Page, caseName: string | null): Promise<CaseResult> {
  const locale = caseName ?? 'en-US';
  await page.goto(new URL(`?locale=${locale}`, page.url()).href);
  await page.locator('[data-bench="instance"] > *').first().waitFor();
  const firstDay = await page.locator(`[data-bench="${CALENDAR}"]`).evaluate((calendar) => {
    const dayElement = (day: number) =>
      Array.from(calendar.querySelectorAll('*')).find(
        (element) =>
          element.textContent.trim() === String(day) &&
          !Array.from(element.children).some((child) => child.textContent.trim() === String(day)),
      );
    const rowOf = (element: Element | undefined) =>
      element?.closest('[role="row"], tr') ?? element?.parentElement;
    for (let day = 2; day <= 7; day++) {
      if (rowOf(dayElement(day)) !== rowOf(dayElement(day - 1))) {
        return day;
      }
    }
    return undefined;
  });
  if (firstDay === undefined) {
    return result(false, 'The days 1 to 7 of January are in one row.');
  }
  const weekday = WEEKDAYS[new Date(Date.UTC(2026, 0, firstDay)).getUTCDay()] ?? '';
  const expected = locale === 'en-GB' ? 'Monday' : 'Sunday';
  return result(weekday === expected, `The week starts on ${weekday}.`);
}

async function outputText(page: Page, marker: string): Promise<string | undefined> {
  await readAfterInput(page, []);
  const output = page.locator(`[data-bench="${marker}"]`);
  return (await output.count()) === 0 ? undefined : ((await output.textContent()) ?? '').trim();
}

async function spinbuttons(page: Page): Promise<CaseResult> {
  const parts = await page
    .locator(`[data-bench="${DATE_FIELD}"]`)
    .getByRole('spinbutton')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        now: Number(element.getAttribute('aria-valuenow') ?? Number.NaN),
        min: Number(element.getAttribute('aria-valuemin') ?? Number.NaN),
        max: Number(element.getAttribute('aria-valuemax') ?? Number.NaN),
      })),
    );
  if (parts.length === 0) {
    return result(false, 'No part has the role spinbutton.');
  }
  const text = (value: number) => (Number.isNaN(value) ? 'none' : String(value));
  const measure = `${parts
    .map(({ now, min, max }) => `${text(now)} (${text(min)} to ${text(max)})`)
    .join(', ')}.`;
  const values = parts.map(({ now }) => now).sort((a, b) => a - b);
  const pass =
    values.join() === '1,15,2026' && parts.every(({ now, min, max }) => min <= now && now <= max);
  return result(pass, measure);
}

async function arrowsAndDigits(page: Page): Promise<CaseResult> {
  if (!(await tabTo(page, DATE_FIELD))) {
    return result(false, NO_TAB_TO_FIELD);
  }
  await page.keyboard.press('ArrowUp');
  const afterArrow = await outputText(page, 'value');
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  const afterDigits = await outputText(page, 'value');
  return result(
    afterArrow === '2026-02-15' && afterDigits === '2026-12-15',
    `ArrowUp: ${afterArrow ?? 'none'}. 1, 2: ${afterDigits ?? 'none'}.`,
  );
}

async function formValue(page: Page): Promise<CaseResult> {
  if (!(await tabTo(page, DATE_FIELD))) {
    return result(false, NO_TAB_TO_FIELD);
  }
  await page.keyboard.press('ArrowUp');
  await readAfterInput(page, []);
  const value = await page.evaluate(() => {
    const form = document.querySelector('form');
    const entry = form && new FormData(form).get('date');
    return typeof entry === 'string' ? entry : null;
  });
  return result(
    value === '2026-02-15',
    value === null
      ? 'The form has no text for date.'
      : `The form gets ${value || 'an empty text'}.`,
  );
}

async function skippedHour(page: Page): Promise<CaseResult> {
  if (!(await tabTo(page, TIME_FIELD))) {
    return result(false, NO_TAB_TO_FIELD);
  }
  await page.keyboard.press('ArrowUp');
  const focus = await focusAfterInput(page, TIME_FIELD);
  const hour = focus.inside ? focus.text : 'outside the field';
  const instant = await outputText(page, 'instant');
  if (instant === undefined) {
    return result(false, `Hour ${hour}.`, 'The value has no time zone.');
  }
  const time = Number(instant);
  const shown = instant === '' || Number.isNaN(time) ? 'none' : new Date(time).toISOString();
  return result(
    Number(hour) === 3 && time === INSTANT_AFTER_GAP,
    `Hour ${hour}. Instant ${shown}.`,
  );
}

async function valueType(page: Page): Promise<CaseResult> {
  if (!(await tabTo(page, DATE_FIELD))) {
    return result(false, NO_TAB_TO_FIELD);
  }
  await page.keyboard.press('ArrowUp');
  return { verdict: 'pass', measure: (await outputText(page, 'value-type')) ?? 'none' };
}

/**
 * Three fixtures. `Calendar`: `calendar` on the value 2026-01-31, with `calendar-heading` on the
 * heading of the month, and the locale of the URL parameter `locale`, else `en-US`. `DateField`:
 * `date-field` on the value 2026-01-15 in `en-US`, in a `<form>` with the name `date`, with the
 * outputs `value` (`String(value)`) and `value-type` (the type of the value). `ZonedTimeField`:
 * `time-field`, hours and minutes in a 24-hour cycle, on 2026-03-08 01:30 in `America/New_York`,
 * with the output `instant` in epoch milliseconds. A fixture whose value has no time zone has no
 * `instant`.
 */
export const DATES_AND_TIMES: Group = {
  id: 'dates-and-times',
  title: 'Dates and times',
  notes: {
    'reka-ui': 'The docs call Calendar, Date Field and Time Field Alpha.',
    'ark-ui':
      'The calendar is Date Picker, open at the start. The time field is Date Input with the time format of its docs.',
    vuetify0:
      'The calendar is the grid of buttons of the createCalendar docs. These docs say that the grid handles no keys. TimePicker has no date and no time zone.',
  },
  checks: [
    {
      id: 'grid-roles',
      title:
        'The calendar is a grid with a name, one selected day and one day in the Tab sequence.',
      expectation: APG_DATE_PICKER,
      scenario: 'Calendar',
      run: gridRoles,
    },
    {
      id: 'arrow-keys',
      title: 'The arrow keys move the focus by a day and by a week.',
      expectation: APG_DATE_PICKER,
      scenario: 'Calendar',
      run: (page) =>
        keysFromSelectedDay(
          page,
          [
            ['ArrowLeft', '30'],
            ['ArrowUp', '23'],
          ],
          focusedDay,
        ),
    },
    {
      id: 'home-and-end',
      title: 'Home and End move the focus to the first and the last day of the week.',
      expectation: APG_DATE_PICKER,
      scenario: 'Calendar',
      // January 31 is the last day of its week and of its month, so End starts in an earlier week.
      run: (page) =>
        keysFromSelectedDay(
          page,
          [
            ['Home', '25'],
            ['ArrowUp', '18'],
            ['End', '24'],
          ],
          focusedDay,
        ),
    },
    {
      id: 'page-keys',
      title: 'Page Down and Page Up change the month, and Shift changes the year.',
      expectation: APG_DATE_PICKER,
      scenario: 'Calendar',
      run: (page) =>
        keysFromSelectedDay(
          page,
          [
            ['PageDown', 'February 2026'],
            ['PageUp', 'January 2026'],
            ['Shift+PageDown', 'January 2027'],
          ],
          headingText,
        ),
    },
    {
      id: 'month-end',
      title: 'From January 31, Page Down moves the focus to the last day of February.',
      expectation: APG_DATE_PICKER,
      scenario: 'Calendar',
      run: (page) => keysFromSelectedDay(page, [['PageDown', '28']], focusedDay),
    },
    {
      id: 'week-start',
      title: 'The week starts on the day of the locale.',
      expectation: {
        text: 'MDN, Intl.Locale.prototype.getWeekInfo()',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getWeekInfo',
      },
      scenario: 'Calendar',
      cases: ['en-US', 'en-GB'],
      run: weekStart,
    },
    {
      id: 'spinbuttons',
      title: 'Each part of the date is a spinbutton with its value and its limits.',
      expectation: APG_SPINBUTTON,
      scenario: 'DateField',
      run: spinbuttons,
    },
    {
      id: 'arrows-and-digits',
      title: 'ArrowUp changes a part, and typed digits fill it.',
      expectation: APG_SPINBUTTON,
      scenario: 'DateField',
      run: arrowsAndDigits,
    },
    {
      id: 'form-value',
      title: 'A form gets the date as yyyy-mm-dd.',
      expectation: {
        text: 'HTML, the date state of the input element',
        url: 'https://html.spec.whatwg.org/multipage/input.html#date-state-(type=date)',
      },
      scenario: 'DateField',
      run: formValue,
    },
    {
      id: 'skipped-hour',
      title: 'A time in an hour that the time zone skips moves forward.',
      expectation: {
        text: 'Temporal, ambiguity and the time zone',
        url: 'https://tc39.es/proposal-temporal/docs/ambiguity.html',
      },
      scenario: 'ZonedTimeField',
      run: skippedHour,
    },
    {
      id: 'value-type',
      title: 'The type of the value that the date field gives.',
      expectation: {
        text: 'Temporal, PlainDate',
        url: 'https://tc39.es/proposal-temporal/docs/plaindate.html',
      },
      scenario: 'DateField',
      kind: 'fact',
      run: valueType,
    },
  ],
};
