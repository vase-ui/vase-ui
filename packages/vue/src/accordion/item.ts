import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type { AccordionRootChangeEventDetails } from './types';

/** What `Accordion.Root` gives to its items. The properties are reactive. */
export interface AccordionRootForItem {
  /** The values of the open items. */
  readonly value: unknown[];
  readonly disabled: boolean;
  /** The `keepMounted` of a panel that has none. */
  readonly keepMounted: boolean;
  /** The `hiddenUntilFound` of a panel that has none. */
  readonly hiddenUntilFound: boolean;
  /** Opens or closes the item with this value, unless a listener cancels. */
  change(value: unknown, open: boolean, details: AccordionRootChangeEventDetails): void;
}

export const accordionRootKey: InjectionKey<AccordionRootForItem> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'accordion root' : undefined,
);

export function injectAccordionRoot() {
  const root = inject(accordionRootKey, null);
  if (!root) {
    throw createError(1);
  }
  return root;
}
