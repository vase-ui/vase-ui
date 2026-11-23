import type { Group } from './types.ts';

const APG_DATE_PICKER = {
  text: 'WAI-ARIA APG, Date Picker Dialog Example',
  url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/',
};
const APG_SPINBUTTON = {
  text: 'WAI-ARIA APG, Spinbutton Pattern',
  url: 'https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/',
};

export const DATES_AND_TIMES: Group = {
  id: 'dates-and-times',
  title: 'Dates and times',
  checks: [
    {
      id: 'grid-roles',
      title:
        'The calendar is a grid with a name, one selected day and one day in the Tab sequence.',
      expectation: APG_DATE_PICKER,
      scenario: 'Calendar',
    },
    {
      id: 'arrow-keys',
      title: 'The arrow keys move the focus by a day and by a week.',
      expectation: APG_DATE_PICKER,
      scenario: 'Calendar',
    },
    {
      id: 'home-and-end',
      title: 'Home and End move the focus to the first and the last day of the week.',
      expectation: APG_DATE_PICKER,
      scenario: 'Calendar',
    },
    {
      id: 'page-keys',
      title: 'Page Down and Page Up change the month, and Shift changes the year.',
      expectation: APG_DATE_PICKER,
      scenario: 'Calendar',
    },
    {
      id: 'month-end',
      title: 'From January 31, Page Down moves the focus to the last day of February.',
      expectation: APG_DATE_PICKER,
      scenario: 'Calendar',
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
    },
    {
      id: 'spinbuttons',
      title: 'Each part of the date is a spinbutton with its value and its limits.',
      expectation: APG_SPINBUTTON,
      scenario: 'DateField',
    },
    {
      id: 'arrows-and-digits',
      title: 'ArrowUp changes a part, and typed digits fill it.',
      expectation: APG_SPINBUTTON,
      scenario: 'DateField',
    },
    {
      id: 'form-value',
      title: 'A form gets the date as yyyy-mm-dd.',
      expectation: {
        text: 'HTML, the date state of the input element',
        url: 'https://html.spec.whatwg.org/multipage/input.html#date-state-(type=date)',
      },
      scenario: 'DateField',
    },
    {
      id: 'skipped-hour',
      title: 'A time in an hour that the time zone skips moves forward.',
      expectation: {
        text: 'Temporal, ambiguity and the time zone',
        url: 'https://tc39.es/proposal-temporal/docs/ambiguity.html',
      },
      scenario: 'ZonedTimeField',
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
    },
  ],
};
