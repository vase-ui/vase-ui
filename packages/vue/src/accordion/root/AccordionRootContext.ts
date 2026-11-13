import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type {
  AccordionRootChangeEventDetails,
  AccordionRootState,
  AccordionValue,
} from './AccordionRoot.vue';

export interface AccordionRootContext<Value = any> {
  disabled: ComputedRef<boolean>;
  handleValueChange: (
    newValue: AccordionValue<Value>[number],
    nextOpen: boolean,
    eventDetails: AccordionRootChangeEventDetails,
  ) => void;
  hiddenUntilFound: ComputedRef<boolean>;
  keepMounted: ComputedRef<boolean>;
  state: ComputedRef<AccordionRootState<Value>>;
  value: ComputedRef<AccordionValue<Value>>;
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
