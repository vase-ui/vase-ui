import { DATES_AND_TIMES } from './datesAndTimes.ts';
import { DRAWERS } from './drawers.ts';
import { NESTED_DIALOGS } from './nestedDialogs.ts';
import { POPUP_ANIMATIONS } from './popupAnimations.ts';
import { RESIZABLE_PANELS } from './resizablePanels.ts';
import { TOASTS } from './toasts.ts';

/** The groups of the behavior checks, in the sequence of the page. */
export const GROUPS = [
  NESTED_DIALOGS,
  DRAWERS,
  TOASTS,
  RESIZABLE_PANELS,
  DATES_AND_TIMES,
  POPUP_ANIMATIONS,
] as const;

/** Each fixture that a check names, once. */
export const BEHAVIOR_SCENARIOS: readonly string[] = [
  ...new Set(
    GROUPS.flatMap((group) =>
      group.checks.flatMap((check) =>
        typeof check.scenario === 'string' ? [check.scenario] : Object.values(check.scenario),
      ),
    ),
  ),
];
