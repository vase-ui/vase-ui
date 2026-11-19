import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { RegisterId } from '../../internals/labelable-provider/createIdRegistry';
import type { AccordionItemState } from './AccordionItem.vue';

export interface AccordionItemContext {
  defaultTriggerId: ComputedRef<string>;
  /**
   * Registers the `id` of a trigger by its source. Two triggers can have the same `id`, and Vue can
   * mount a trigger before it unmounts the trigger that it replaces.
   */
  registerTriggerId: RegisterId;
  state: ComputedRef<AccordionItemState>;
  /**
   * The `id` of the last trigger that is registered now. With no such trigger, it is `undefined`,
   * so a panel names only a trigger that exists.
   */
  triggerId: ComputedRef<string | undefined>;
}

export const AccordionItemContext: InjectionKey<AccordionItemContext> = Symbol();

export function useAccordionItemContext(): AccordionItemContext {
  const context = inject(AccordionItemContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Accordion must be inside <Accordion.Item>. Without an item the part has no open state to read. Put the part inside <Accordion.Item>.',
    );
  }

  return context;
}
