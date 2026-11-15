import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type {
  CollapsibleRootChangeEventDetails,
  CollapsibleRootState,
} from './CollapsibleRoot.vue';
import type { UseCollapsibleRootReturnValue } from './useCollapsibleRoot';

export interface CollapsibleRootContext extends UseCollapsibleRootReturnValue {
  onOpenChange: (open: boolean, eventDetails: CollapsibleRootChangeEventDetails) => void;
  state: ComputedRef<CollapsibleRootState>;
}

export const CollapsibleRootContext: InjectionKey<CollapsibleRootContext> = Symbol();

export function useCollapsibleRootContext(): CollapsibleRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(CollapsibleRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Collapsible must be inside <Collapsible.Root>. Without a root the part has no open state to read. Put the part inside <Collapsible.Root>.',
    );
  }

  return context;
}
