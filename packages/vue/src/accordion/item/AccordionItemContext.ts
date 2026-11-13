import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { RegisterId } from '../../internals/labelable-provider/LabelableContext';
import type { AccordionItemState } from './AccordionItem.vue';

export interface AccordionItemContext {
  /**
   * The `id` of a trigger that has no `id` of its own. The item makes it, so that the panel can
   * name the trigger before the trigger renders.
   */
  defaultTriggerId: ComputedRef<string>;
  /**
   * Registers the `id` of a trigger by its source. Two triggers can have the same `id`, and Vue can
   * mount a trigger before it unmounts the trigger that it replaces.
   */
  registerTriggerId: RegisterId;
  state: ComputedRef<AccordionItemState>;
  /**
   * The `id` of the last trigger of the item. Until a trigger registers, it is `defaultTriggerId`.
   * After a trigger has registered and then left, it is `undefined`.
   */
  triggerId: ComputedRef<string | undefined>;
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
