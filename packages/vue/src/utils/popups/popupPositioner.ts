import { computed, toRaw, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
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
import type { UseRenderElementReturnValue } from '../../internals/useRenderElement';
import type { AdaptiveOriginMiddleware } from './positioning/adaptiveOriginConstants';
import { useVaseUIFloating } from './positioning/useFloating';
import type { UseFloatingOptions } from './positioning/useFloating';
import { usePositioner } from './positioning/usePositioner';
import type { ReactiveStore } from './ReactiveStore';
import type { PopupStoreContext, PopupStoreSelectors, PopupStoreState } from './store';
import type { PositioningInteractionStore } from './types';

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
type PopupPositionerStore = ReactiveStore<
  Readonly<PopupStoreState<unknown>>,
  PopupStoreContext<never>,
  PopupStoreSelectors
> &
  PositioningInteractionStore & {
    select(key: 'instantType'): string | undefined;
    select(key: 'adaptiveOrigin'): AdaptiveOriginMiddleware | undefined;
  };

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
  store: PopupPositionerStore,
  props: VaseUIComponentProps<State> & UseAnchorPositioningSharedParameters,
  options: UsePopupPositionerOptions<State>,
): UsePopupPositionerReturnValue<State> {
  const { nodeId, externalTree, ...positioningOverrides } = options.positioning ?? {};

  const open = computed(() => store.select('open'));
  const mounted = computed(() => store.select('mounted'));

  const positioning = useAnchorPositioning({
    anchor: () => props.anchor,
    positionMethod: () => props.positionMethod,
    side: () => props.side,
    sideOffset: () => props.sideOffset,
    align: () => props.align,
    alignOffset: () => props.alignOffset,
    arrowPadding: () => props.arrowPadding,
    collisionBoundary: () => props.collisionBoundary,
    collisionPadding: () => props.collisionPadding,
    sticky: () => props.sticky,
    disableAnchorTracking: () => props.disableAnchorTracking,
    collisionAvoidance: () => props.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE,
    keepMounted: options.keepMounted,
    mounted,
    positionerElement: () => store.select('positionerElement'),
    defaultAnchor: () => store.select('anchor'),
    adaptiveOrigin: () => store.select('adaptiveOrigin'),
    ...positioningOverrides,
  });

  useVaseUIFloating({ rootStore: store, mounted, positioning, nodeId, externalTree });

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

  let positionerElement: HTMLElement | null = null;

  const { element, elementProps } = usePositioner(props, {
    state,
    styles: positioning.positionerStyles,
    transitionStatus: () => store.select('transitionStatus'),
    ref(positioner) {
      // A compiled template can mount a new positioner before it unmounts the old one. The old
      // one then must not clear the element of the new one.
      if (positioner !== null || toRaw(store.state).positionerElement === positionerElement) {
        store.set('positionerElement', positioner);
      }
      positionerElement = positioner;
    },
    hidden: () => !mounted.value,
    inert: () => toValue(options.inert) ?? !open.value,
  });

  return { element, elementProps, state, positioning, open, mounted };
}
