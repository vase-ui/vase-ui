import type { DayOfWeek } from '../common/date-time/temporal';

// The regions whose week does not start on Monday, from `weekData.firstDay` of CLDR 49
// (cldr-json, `cldr-core/supplemental/weekData.json`). `Intl.Locale#getWeekInfo` is not Baseline
// Widely available, and the server and the browser must give the same day.
const regionsByFirstDay: readonly (readonly [DayOfWeek, string])[] = [
  [
    7,
    'AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN IS JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW',
  ],
  [6, 'AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY'],
  [5, 'MV'],
];

/**
 * The first day of the week in the region of `locale`. A locale with no region takes its likely
 * region, so `en` gives the day of `US`. The week of any other region starts on Monday.
 */
export function getFirstDayOfWeek(locale: Intl.LocalesArgument): DayOfWeek {
  const [tag] = [locale].flat();
  const region = tag === undefined ? undefined : new Intl.Locale(tag).maximize().region;
  const entry =
    region && regionsByFirstDay.find(([, regions]) => regions.split(' ').includes(region));
  return entry ? entry[0] : 1;
}
