import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { collapsibleOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { AccordionItemState } from '../item/AccordionItem.vue';
import * as AccordionItemDataAttributes from '../item/AccordionItemDataAttributes';
import type { CompositeListContextValue } from '../../internals/composite/list/useCompositeList';
import type { AccordionRootChangeEventDetails, AccordionRootState } from './AccordionRoot.vue';

export const accordionStateAttributesMapping: StateAttributesMapping<AccordionItemState> = {
  ...collapsibleOpenStateMapping,
  index: (value) => ({ [AccordionItemDataAttributes.index]: String(value) }),
  ...transitionStatusMapping,
  value: () => null,
};

export interface AccordionRootContext<Value = any> {
  handleValueChange: (
    newValue: Value,
    nextOpen: boolean,
    eventDetails: AccordionRootChangeEventDetails,
  ) => void;
  hiddenUntilFound: ComputedRef<boolean>;
  /**
   * The list of the items. The items register with it through this context. The root does not
   * provide the list, so an item of a composite around the root joins that composite.
   */
  itemList: CompositeListContextValue<unknown>;
  keepMounted: ComputedRef<boolean>;
  state: ComputedRef<AccordionRootState<Value>>;
}

export const AccordionRootContext: InjectionKey<AccordionRootContext> = Symbol();

export function useAccordionRootContext<Value = any>(): AccordionRootContext<Value> {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(AccordionRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Accordion must be inside <Accordion.Root>. Without a root the part has no value to read. Put the part inside <Accordion.Root>.',
    );
  }

  return context;
}
