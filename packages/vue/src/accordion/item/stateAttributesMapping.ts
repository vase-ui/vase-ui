import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { collapsibleOpenStateMapping as baseMapping } from '../../utils/collapsibleOpenStateMapping';
import type { AccordionItemState } from './AccordionItem.vue';
import * as AccordionItemDataAttributes from './AccordionItemDataAttributes';

export const accordionStateAttributesMapping: StateAttributesMapping<AccordionItemState> = {
  ...baseMapping,
  index: (value) => ({ [AccordionItemDataAttributes.index]: String(value) }),
  ...transitionStatusMapping,
  value: () => null,
};
