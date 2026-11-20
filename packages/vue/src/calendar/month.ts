import { inject, type InjectionKey } from 'vue';
import type { CalendarDayState, CalendarPage } from './types';

/** What `Calendar.Month` gives to its parts. The properties are reactive. */
export interface MonthForPart {
  readonly page: CalendarPage;
  /** The name of the page, in the default format. */
  readonly text: string;
  /** The id of the first caption of the month. */
  readonly captionId: string | undefined;
  /** Adds a caption. Returns the function that removes it. */
  addCaption(caption: { readonly id: string }): () => void;
}

export const monthKey: InjectionKey<MonthForPart> = Symbol('calendar month');

/** The month of a part, or `null` outside a month. */
export function injectMonth(): MonthForPart | null {
  return inject(monthKey, null);
}

/** The month of a part that needs one. */
export function injectRequiredMonth() {
  const month = injectMonth();
  if (!month) {
    throw new Error(
      'Vase UI: A part of a month of Calendar must be inside <Calendar.Month>. Without a month the part has no weeks to show. Put the part inside <Calendar.Month>.',
    );
  }
  return month;
}

/** What `Calendar.Day` gives to its button. The properties are reactive. */
export interface DayForButton {
  readonly day: Temporal.PlainDate;
  readonly state: CalendarDayState;
}

export const dayKey: InjectionKey<DayForButton> = Symbol('calendar day');

export function injectDay() {
  const day = inject(dayKey, null);
  if (!day) {
    throw new Error(
      'Vase UI: <Calendar.DayButton> must be inside <Calendar.Day>. Without a day the button has no date to select. Put the button inside <Calendar.Day>.',
    );
  }
  return day;
}
