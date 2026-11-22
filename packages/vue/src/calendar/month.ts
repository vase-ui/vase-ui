import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
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

export const monthKey: InjectionKey<MonthForPart> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'calendar month' : undefined,
);

/** The month of a part, or `null` outside a month. */
export function injectMonth(): MonthForPart | null {
  return inject(monthKey, null);
}

/** The month of a part that needs one. */
export function injectRequiredMonth() {
  const month = injectMonth();
  if (!month) {
    throw createError(6);
  }
  return month;
}

/** What `Calendar.Day` gives to its button. The properties are reactive. */
export interface DayForButton {
  readonly day: Temporal.PlainDate;
  readonly state: CalendarDayState;
}

export const dayKey: InjectionKey<DayForButton> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'calendar day' : undefined,
);

export function injectDay() {
  const day = inject(dayKey, null);
  if (!day) {
    throw createError(7);
  }
  return day;
}
