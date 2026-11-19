import { useDomEffect } from './useDomEffect';
import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
import { createElementSetter, stateElementTarget } from './createElementSetter';
import { useElementRegistration } from '../../internals/useElementRegistration';
import { positionerHandlers } from './registeredParts';
import { computed, shallowReactive, toValue, onBeforeMount, onScopeDispose, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, CSSProperties } from 'vue';
import { POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { useAnchorPositioning } from '../../internals/useAnchorPositioning';
import type {
  Align,
  Side,
  UseAnchorPositioningParameters,
  UseAnchorPositioningReturnValue,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';
import type { VaseUIComponentProps } from '../../internals/types';
import type {
  UseRenderElementReturnValue,
  UseRenderElementComponentProps,
  UseRenderElementParameters,
} from '../../internals/useRenderElement';
import type { AdaptiveOriginMiddleware } from './positioning/adaptiveOriginMiddleware';
import type { ReactiveStore } from './handleStoreAdapter';
import type { PopupStoreContext, PopupStoreSelectors, PopupStoreState } from './usePopupRoot';
import type {
  PositioningInteractionStore,
  ExtendedElements,
  FloatingNodeType,
  PopupPositioningContext,
} from './types';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { useRenderElement } from '../../internals/useRenderElement';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useHoverPointerStyle } from './interactions/usePopupHover';
import { popupStateMapping } from './popupStateMapping';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { removeNodeContext, useFloatingTree } from './tree/FloatingTree';
import type { FloatingTreeStore } from './tree/FloatingTreeStore';

/**
 * The state that every popup positioner shares.
 */
export interface PopupPositionerState {
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  instant: string | undefined;
}

// The two selectors are members and not keys of the selector type. A key would make the selector
// of a family, which reads the state of that family, not fit.
export type PopupPositionerStore = ReactiveStore<
  Readonly<PopupStoreState<unknown>>,
  PopupStoreContext<never>,
  PopupStoreSelectors
> &
  PositioningInteractionStore & {
    select(key: 'instantType'): string | undefined;
    select(key: 'adaptiveOrigin'): AdaptiveOriginMiddleware | undefined;
  };

type PlacementOptions = Omit<UseAnchorPositioningParameters, 'collisionAvoidance'> &
  Partial<Pick<UseAnchorPositioningParameters, 'collisionAvoidance'>> &
  Partial<Pick<UseFloatingOptions, 'rootStore' | 'nodeId' | 'externalTree'>>;

export function usePopupPlacement(
  read: <K extends keyof UseAnchorPositioningSharedParameters>(
    key: K,
  ) => UseAnchorPositioningSharedParameters[K],
  options: PlacementOptions,
) {
  const { rootStore, nodeId, externalTree, ...overrides } = options;
  const placement = useAnchorPositioning({
    anchor: () => read('anchor'),
    positionMethod: () => read('positionMethod'),
    side: () => read('side'),
    sideOffset: () => read('sideOffset'),
    align: () => read('align'),
    alignOffset: () => read('alignOffset'),
    arrowPadding: () => read('arrowPadding'),
    collisionBoundary: () => read('collisionBoundary'),
    collisionPadding: () => read('collisionPadding'),
    sticky: () => read('sticky'),
    disableAnchorTracking: () => read('disableAnchorTracking'),
    collisionAvoidance: () => read('collisionAvoidance') ?? POPUP_COLLISION_AVOIDANCE,
    ...overrides,
  });
  if (rootStore) {
    useVaseUIFloating({
      rootStore,
      nodeId,
      externalTree,
      mounted: options.mounted,
      positioning: placement,
    });
  }
  return placement;
}

export interface UsePopupPositionerOptions<State extends PopupPositionerState> {
  /**
   * Whether the popup stays mounted while it is closed.
   */
  keepMounted: MaybeRefOrGetter<boolean>;
  /**
   * Positioning parameters that replace the props, such as values from the parent of the popup.
   * `nodeId` and `externalTree` are for the positioning context. Each of them is a value, a ref or
   * a getter.
   */
  positioning?:
    | (Partial<
        Omit<
          UseAnchorPositioningParameters,
          'mounted' | 'keepMounted' | 'adaptiveOrigin' | 'positionerElement' | 'defaultAnchor'
        >
      > &
        Pick<UseFloatingOptions, 'nodeId' | 'externalTree'>)
    | undefined;
  /**
   * State that the part adds to or changes in the shared state.
   */
  state?: MaybeRefOrGetter<
    (Omit<State, keyof PopupPositionerState> & Partial<PopupPositionerState>) | undefined
  >;
  /**
   * Whether the positioner ignores pointer events.
   * @default !open
   */
  inert?: MaybeRefOrGetter<boolean | undefined>;
}

export interface UsePopupPositionerReturnValue<
  State extends PopupPositionerState,
> extends UseRenderElementReturnValue<HTMLDivElement> {
  state: ComputedRef<State>;
  positioning: UseAnchorPositioningReturnValue;
  open: ComputedRef<boolean>;
  mounted: ComputedRef<boolean>;
}

/**
 * Does what every popup positioner does. It positions the popup against its anchor, gives the
 * positioner element to the store, and makes the props of the element from the shared state.
 * The part adds what is specific to its popup, such as a backdrop or a scroll lock.
 *
 * Call it in `setup`, with the reactive props of the part. Do not destructure the props.
 */
export function usePopupPositioner<State extends PopupPositionerState>(
  props: VaseUIComponentProps<State> & UseAnchorPositioningSharedParameters,
  store: PopupPositionerStore,
  options: UsePopupPositionerOptions<State>,
): UsePopupPositionerReturnValue<State> {
  const open = computed(() => store.select('open'));
  const mounted = computed(() => store.select('mounted'));
  const positioning = usePopupPlacement((key) => props[key], {
    rootStore: store,
    keepMounted: options.keepMounted,
    mounted,
    positionerElement: () => store.select('positionerElement'),
    defaultAnchor: () => store.select('anchor'),
    adaptiveOrigin: () => store.select('adaptiveOrigin'),
    ...options.positioning,
  });

  const state = computed(
    () =>
      ({
        open: open.value,
        side: positioning.side.value,
        align: positioning.align.value,
        anchorHidden: positioning.anchorHidden.value,
        instant: store.select('instantType'),
        ...toValue(options.state),
      }) as State,
  );

  const { element, elementProps, setRef, usesRenderSlot } = usePositioner(props, {
    state,
    styles: () => ({
      ...positioning.positionerStyles.value,
      ...store.context.viewportStyles.value?.positioner.value,
    }),
    transitionStatus: () => store.select('transitionStatus'),
    ref: createElementSetter(stateElementTarget(store, 'positionerElement'), {
      keepWhileHeld: true,
    }),
    hidden: () => !mounted.value,
    inert: () => toValue(options.inert) ?? !open.value,
  });

  return { element, elementProps, setRef, usesRenderSlot, state, positioning, open, mounted };
}

export interface UsePositionerOptions<State> {
  props?: Record<string, unknown>;
  /**
   * The state of the positioner.
   */
  state: MaybeRefOrGetter<State>;
  /**
   * The style of the positioner, such as `positionerStyles` of `useAnchorPositioning`.
   */
  styles: MaybeRefOrGetter<CSSProperties>;
  transitionStatus: MaybeRefOrGetter<TransitionStatus>;
  /**
   * Callbacks that get the element of the positioner.
   */
  ref?: UseRenderElementParameters<State, HTMLDivElement>['ref'];
  /**
   * Whether the positioner has the `hidden` attribute.
   */
  hidden?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether the positioner ignores pointer events.
   * @default false
   */
  inert?: MaybeRefOrGetter<boolean | undefined>;
}

/**
 * Makes the props of the outer positioner element that popups share. It gives the element its
 * role, its hidden state, its style and the state attributes of a popup.
 * Call it in `setup`. The template binds the result of `elementProps()` on the element, and it
 * binds `setRef` by name on that element.
 */
export function usePositioner<State extends Record<string, any>>(
  componentProps: UseRenderElementComponentProps<State>,
  options: UsePositionerOptions<State>,
): UseRenderElementReturnValue<HTMLDivElement> {
  const handlers = shallowReactive(new Set<Record<string, unknown>>());
  const result: UseRenderElementReturnValue<HTMLDivElement> = useRenderElement<
    State,
    HTMLDivElement
  >('div', componentProps, {
    state: options.state,
    ref: options.ref,
    stateAttributesMapping: popupStateMapping,
    props: (attrs) => {
      const style: CSSProperties = { ...toValue(options.styles), ...hoverStyle.value };
      if (toValue(options.inert)) {
        style.pointerEvents = 'none';
      }

      return [
        {
          role: 'presentation',
          // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
          hidden: toValue(options.hidden) ? true : undefined,
          style,
        },
        getDisabledMountTransitionStyles(toValue(options.transitionStatus)),
        ...handlers,
        options.props,
        attrs,
      ];
    },
  });
  useElementRegistration(positionerHandlers, result.element, () => handlers);
  const hoverStyle = useHoverPointerStyle(result.element);
  return result;
}

export interface UseFloatingOptions {
  /**
   * The store of the popup. It owns the anchor element and the positioner element.
   */
  rootStore: MaybeRefOrGetter<PositioningInteractionStore>;
  /**
   * Whether the popup is mounted. The store forgets its anchor while the popup is not mounted.
   */
  mounted: MaybeRefOrGetter<boolean>;
  /**
   * The return value of `useAnchorPositioning`.
   */
  positioning: Pick<UseAnchorPositioningReturnValue, 'placement' | 'reference'>;
  /**
   * The id of the node of the popup in the popup tree. Call `useFloatingNodeId` before this
   * composable. A popup that can move to the node of another part, such as the node of a detached
   * trigger, gives a ref or a getter. The context then moves to the new node.
   */
  nodeId?: MaybeRefOrGetter<string | undefined>;
  /**
   * The tree to use when the tree of the context cannot reach the part.
   */
  externalTree?: MaybeRefOrGetter<FloatingTreeStore | undefined>;
}

/**
 * Makes the positioning context of a popup. It gives the context to the store and to the node of
 * the popup in the popup tree, where the interaction composables and the other popups read it.
 *
 * The context is one plain object. `open` is the state of the last DOM update. Each other member
 * that can change is a getter, so a read gives the current value.
 *
 * Call it in `setup`, after `useAnchorPositioning`.
 * @see https://floating-ui.com/docs/useFloating
 */
export function useVaseUIFloating(options: UseFloatingOptions): PopupPositioningContext {
  const { positioning } = options;

  const rootStore = computed(() => toValue(options.rootStore));
  const tree = useFloatingTree(options.externalTree);

  const elements: ExtendedElements = {
    get reference() {
      return positioning.reference.value;
    },
    get floating() {
      return rootStore.value.select('positionerElement');
    },
    get domReference() {
      return rootStore.value.select('anchorElement');
    },
  };
  const context: PopupPositioningContext = {
    open: rootStore.value.select('open'),
    get placement() {
      return positioning.placement.value;
    },
    get nodeId() {
      return toValue(options.nodeId);
    },
    elements,
    get rootStore() {
      return rootStore.value;
    },
  };

  // A popup above reads `open` in the event in which this popup closes, and it must still see this
  // popup as open. A getter that reads the store would give `false` there.
  watch(
    () => rootStore.value.select('open'),
    (open) => {
      context.open = open;
    },
    { flush: 'post' },
  );

  let published: PositioningInteractionStore | null = null;
  let publishedNode: FloatingNodeType | undefined;
  const { isHeld } = useKeepAliveState();

  function unpublish() {
    if (published?.context.positioning === context) {
      published.context.positioning = undefined;
    }
    published = null;
  }

  function unpublishNode() {
    if (publishedNode) {
      removeNodeContext(publishedNode, context);
    }
    publishedNode = undefined;
  }

  function publish() {
    const store = isHeld.value ? null : rootStore.value;
    if (store !== published) {
      unpublish();
      if (store) {
        store.context.positioning = context;
        published = store;
      }
    }

    const nodeId = toValue(options.nodeId);
    const node =
      isHeld.value || nodeId === undefined
        ? undefined
        : tree.value?.nodesRef.value.find((candidate) => candidate.id === nodeId);
    if (node !== publishedNode) {
      unpublishNode();
      publishedNode = node;
    }
    if (node) {
      node.context = context;
    }
  }

  // A server does not call `onBeforeMount`, so a server render writes nothing. The hook runs before
  // the `setup` of the parts below. A popup that mounts in a held branch writes at the activation.
  onBeforeMount(publish);
  watch([rootStore, () => tree.value?.nodesRef.value, () => toValue(options.nodeId)], publish);
  onScopeDispose(() => {
    unpublish();
    unpublishNode();
  });

  // The tree hides the context of a node only while `KeepAlive` holds the part of that node. This
  // popup can use the node of a part that stays active, so the node and the store lose the context
  // while `KeepAlive` holds this popup.
  watch(isHeld, publish, { flush: 'sync' });

  function clearPositioningWhileNotMounted() {
    if (!toValue(options.mounted)) {
      rootStore.value.clearPositioning();
    }
  }

  onBeforeMount(clearPositioningWhileNotMounted);
  watch([rootStore, () => toValue(options.mounted)], clearPositioningWhileNotMounted);

  return context;
}

// Popover and Menu have different types for `instantType`, so only the members that the
// composable uses are typed.
interface TriggerSwitchStore {
  // The composable reads the state, not the selector. The selector hides `trigger-change` while
  // the popup is closed, and that is the time when the composable must clear it.
  readonly state: { readonly instantType: string | undefined };
  set(key: 'instantType', value: 'trigger-change' | undefined): void;
  select(key: 'open'): boolean;
}

export interface UseTriggerSwitchTransitionParameters {
  store: TriggerSwitchStore;
  /**
   * The trigger element that currently owns the popup.
   */
  domReference: MaybeRefOrGetter<Element | null>;
  positionerElement: MaybeRefOrGetter<HTMLElement | null>;
  open: MaybeRefOrGetter<boolean>;
}

/**
 * Lets the positioner animate while a popup moves between detached triggers.
 *
 * The positioner has `data-instant` while `instantType` is set. A style of the consumer can turn
 * the transitions off with that attribute, and a move to another trigger would then jump. The
 * composable clears `instantType` for the time of the move, so that the positioner can
 * transition. It sets `trigger-change` when the animations of the move end.
 *
 * That write waits for the animations, so it can outlive the move that scheduled it. The popup
 * keeps its trigger element through the exit transition, so a close does not change
 * `domReference`, and nothing else would stop the write. A popup that closes and opens again on
 * the same trigger during its exit would then keep the old write and lose its own transition. A
 * close thus cancels the write.
 *
 * A controlled `open` of `false` reaches the popup with no call of `setOpen`. The selector of
 * `instantType` thus also stops a closed popup from showing `trigger-change`.
 *
 * Call it in `setup`.
 */
export function useTriggerSwitchTransition(parameters: UseTriggerSwitchTransitionParameters): void {
  const { store, domReference, positionerElement, open } = parameters;

  let previousTrigger: Element | null = null;
  let pendingSwitch: AbortController | null = null;
  const runOnceAnimationsFinish = useAnimationsFinished(positionerElement);

  useDomEffect([() => toValue(open)], () => {
    if (toValue(open)) {
      return;
    }

    pendingSwitch?.abort();
    pendingSwitch = null;

    // `trigger-change` belongs to the open cycle that wrote it. The selector hides it while the
    // popup is closed, but the value must go too. A controlled reopen changes only the `open`
    // prop, so no later write would replace it, and the selector would show it in the new cycle.
    if (store.state.instantType === 'trigger-change') {
      store.set('instantType', undefined);
    }
  });

  useDomEffect([() => toValue(domReference)], () => {
    const currentTrigger = toValue(domReference);
    const lastTrigger = previousTrigger;

    if (currentTrigger) {
      previousTrigger = currentTrigger;
    }

    if (!lastTrigger || !currentTrigger || currentTrigger === lastTrigger) {
      return undefined;
    }

    // A trigger element can also change while the popup closes, when a new element replaces a
    // trigger. There is no move to animate. The cancel effect above runs only when `open`
    // changes, so a write that this effect schedules after the close would stay for the next open.
    if (!store.select('open')) {
      return undefined;
    }

    store.set('instantType', undefined);

    const abortController = new AbortController();
    pendingSwitch = abortController;

    runOnceAnimationsFinish(() => {
      // A close aborts the write. The animations can end in the same frame as the close, before
      // the abort. The write then would leave `trigger-change` for the next open.
      if (store.select('open')) {
        store.set('instantType', 'trigger-change');
      }
    }, abortController.signal);

    return () => {
      abortController.abort();
    };
  });
}
