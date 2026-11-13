import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { AccordionItemState } from './AccordionItem.vue';

export interface AccordionItemContext {
  /**
   * The `id` of a trigger that has no `id` of its own. The item makes it, so that the panel can
   * name the trigger before the trigger renders.
   */
  defaultTriggerId: ComputedRef<string>;
  state: ComputedRef<AccordionItemState>;
}

export const AccordionItemContext: InjectionKey<AccordionItemContext> = Symbol();

export function useAccordionItemContext(): AccordionItemContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(AccordionItemContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Accordion must be inside <Accordion.Item>. Without an item the part has no open state to read. Put the part inside <Accordion.Item>.',
    );
  }

  return context;
}
