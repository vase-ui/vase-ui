import { inject, type InjectionKey } from 'vue';
import type { CollapsiblePart } from '../collapsible/part';
import { createError } from '../common/createError';
import type { AccordionItemState } from './types';

/** A trigger of an item, from its `setup` to its unmount. The properties are reactive. */
export interface AccordionTriggerEntry {
  readonly id: string;
}

/** What `Accordion.Item` gives to its header, its trigger and its panel. The properties are reactive. */
export interface AccordionItemForParts extends CollapsiblePart {
  readonly state: AccordionItemState;
  /** The id of the first trigger. */
  readonly triggerId: string | undefined;
  /** The `keepMounted` of a panel that has none. */
  readonly keepMounted: boolean;
  /** The `hiddenUntilFound` of a panel that has none. */
  readonly hiddenUntilFound: boolean;
  /** Adds a trigger. Returns the function that removes it. */
  addTrigger(trigger: AccordionTriggerEntry): () => void;
}

export const accordionItemKey: InjectionKey<AccordionItemForParts> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'accordion item' : undefined,
);

export function injectAccordionItem() {
  const item = inject(accordionItemKey, null);
  if (!item) {
    throw createError(2);
  }
  return item;
}
