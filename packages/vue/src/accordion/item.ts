import { inject, type InjectionKey } from 'vue';
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

export const accordionRootKey: InjectionKey<AccordionRootForItem> = Symbol('accordion root');

export function injectAccordionRoot() {
  const root = inject(accordionRootKey, null);
  if (!root) {
    throw new Error(
      'Vase UI: <Accordion.Item> must be inside <Accordion.Root>. Without a root the item has no value to read. Put the item inside <Accordion.Root>.',
    );
  }
  return root;
}
