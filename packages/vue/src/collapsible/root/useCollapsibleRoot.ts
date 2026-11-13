import { computed, shallowRef, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { useControlled } from '../../common/useControlled';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import type { RegisterId } from '../../internals/labelable-provider/LabelableContext';
import { REASONS } from '../../internals/reasons';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { CollapsibleRootChangeEventDetails } from './CollapsibleRoot.vue';

export function useCollapsibleRoot(
  parameters: UseCollapsibleRootParameters,
): UseCollapsibleRootReturnValue {
  const { onOpenChange } = parameters;

  const [open, setOpen] = useControlled({
    controlled: () => toValue(parameters.open),
    default: () => toValue(parameters.defaultOpen) ?? false,
    name: 'Collapsible',
    state: 'open',
  });

  const disabled = computed(() => toValue(parameters.disabled));

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(
    open,
    true,
    true,
    false,
    parameters.element,
  );

  const defaultPanelId = useVaseUiId();
  const { ids: panelIds, registerId } = createIdRegistry();
  // A trigger renders before its panel registers. Until then, the root assumes the generated id.
  const hasRegisteredPanel = shallowRef(false);
  const panelId = computed(
    () => panelIds.value.at(-1) ?? (hasRegisteredPanel.value ? undefined : defaultPanelId.value),
  );

  const registerPanelId: RegisterId = (source, getId) => {
    if (getId) {
      hasRegisteredPanel.value = true;
    }
    registerId(source, getId);
  };

  function handleTrigger(event: MouseEvent | KeyboardEvent) {
    const nextOpen = !open.value;
    const eventDetails = createChangeEventDetails(REASONS.triggerPress, event);

    onOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setOpen(nextOpen);
  }

  return {
    defaultPanelId,
    disabled,
    handleTrigger,
    mounted,
    open,
    panelId,
    registerPanelId,
    setMounted,
    setOpen,
    transitionStatus,
  };
}

export interface UseCollapsibleRootParameters {
  /**
   * Whether the collapsible panel is currently open.
   *
   * To render an uncontrolled collapsible, use the `defaultOpen` prop instead.
   */
  open?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether the collapsible panel is initially open.
   *
   * To render a controlled collapsible, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange: (open: boolean, eventDetails: CollapsibleRootChangeEventDetails) => void;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled: MaybeRefOrGetter<boolean>;
  /**
   * The element that gets the transition attributes of the root. The composable reads its layout
   * one time after the DOM update that applies `data-starting-style`.
   */
  element?: MaybeRefOrGetter<Element | null | undefined>;
}

export interface UseCollapsibleRootReturnValue {
  defaultPanelId: ComputedRef<string>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: ComputedRef<boolean>;
  handleTrigger: (event: MouseEvent | KeyboardEvent) => void;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: Readonly<Ref<boolean>>;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: ComputedRef<boolean>;
  panelId: ComputedRef<string | undefined>;
  registerPanelId: RegisterId;
  setMounted: (nextMounted: boolean) => void;
  setOpen: (open: boolean) => void;
  transitionStatus: Readonly<Ref<TransitionStatus>>;
}
