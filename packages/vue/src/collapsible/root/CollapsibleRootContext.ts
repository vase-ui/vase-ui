import { computed, inject, provide, toValue } from 'vue';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter, Ref } from 'vue';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import type { RegisterId } from '../../internals/labelable-provider/createIdRegistry';
import { REASONS } from '../../internals/reasons';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { collapsibleOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type {
  CollapsibleRootChangeEventDetails,
  CollapsibleRootState,
} from './CollapsibleRoot.vue';

export const collapsibleStateAttributesMapping: StateAttributesMapping<CollapsibleRootState> = {
  ...collapsibleOpenStateMapping,
  ...transitionStatusMapping,
};

export interface CollapsibleRootContext {
  state: ComputedRef<CollapsibleRootState>;
  mounted: Readonly<Ref<boolean>>;
  setMounted: (mounted: boolean) => void;
  requestOpen: (open: boolean, details: CollapsibleRootChangeEventDetails) => void;
  handleTrigger: (event: MouseEvent | KeyboardEvent) => void;
  defaultPanelId: ComputedRef<string>;
  panelId: ComputedRef<string | undefined>;
  registerPanelId: RegisterId;
}

const CollapsibleRootContext: InjectionKey<CollapsibleRootContext> = Symbol();

export function useCollapsibleRoot(
  open: MaybeRefOrGetter<boolean>,
  disabled: MaybeRefOrGetter<boolean>,
  requestOpen: CollapsibleRootContext['requestOpen'],
  element?: MaybeRefOrGetter<Element | null>,
): CollapsibleRootContext {
  const { mounted, setMounted, transitionStatus } = useTransitionStatus(
    open,
    true,
    true,
    false,
    element,
  );
  const { ids, registerId } = createIdRegistry();
  const context: CollapsibleRootContext = {
    state: computed(() => ({
      open: toValue(open),
      disabled: toValue(disabled),
      transitionStatus: transitionStatus.value,
    })),
    mounted,
    setMounted,
    requestOpen,
    handleTrigger(event) {
      requestOpen(!toValue(open), createChangeEventDetails(REASONS.triggerPress, event));
    },
    defaultPanelId: useVaseUiId(),
    panelId: computed(() => ids.value.at(-1)),
    registerPanelId: registerId,
  };
  provide(CollapsibleRootContext, context);
  return context;
}

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
