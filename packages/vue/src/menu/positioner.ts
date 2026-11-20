import { computed, onUnmounted, provide, watch, type Ref } from 'vue';
import { usePlacement, type CollisionAvoidance, type PlacementProps } from '../popup/placement';
import { sizeVariables } from '../popup/viewport';
import { injectMenu, injectPortal, positionerKey } from './root';
import type { MenuPositionerState } from './types';

const DROPDOWN: CollisionAvoidance = { fallbackAxisSide: 'none' };
const SUBMENU: CollisionAvoidance = { fallbackAxisSide: 'end' };

/**
 * Places a menu. A prop with no value takes the default of the place of the menu: a submenu opens
 * at the inline end of its trigger, and a context menu at the pointer.
 */
export function useMenuPositioner(
  props: PlacementProps,
  element: Readonly<Ref<HTMLElement | null>>,
) {
  const context = injectMenu('Positioner');
  injectPortal('Positioner');
  const kind = () => context.kind;
  const verticalBar = () => context.menubar?.orientation === 'vertical';
  const align = () => props.align ?? (kind() === 'menu' ? 'center' : 'start');
  // A context menu with no side opens at the pointer, a little over it.
  const atPointer = () => kind() === 'context' && !props.side && align() !== 'center';
  const placementProps = {
    get side() {
      return (
        props.side ??
        (kind() === 'submenu' || (kind() === 'menubar' && verticalBar()) ? 'inline-end' : 'bottom')
      );
    },
    get align() {
      return align();
    },
    get sideOffset() {
      return props.sideOffset ?? (atPointer() ? -5 : 0);
    },
    get alignOffset() {
      return props.alignOffset ?? (atPointer() ? 2 : 0);
    },
    get anchor() {
      return props.anchor ?? (kind() === 'context' ? context.anchor : undefined);
    },
    get collisionAvoidance() {
      return props.collisionAvoidance ?? (kind() === 'submenu' ? SUBMENU : DROPDOWN);
    },
    get collisionBoundary() {
      return props.collisionBoundary ?? 'clipping-ancestors';
    },
    get collisionPadding() {
      return props.collisionPadding ?? 5;
    },
    get sticky() {
      return props.sticky ?? false;
    },
    get arrowPadding() {
      return props.arrowPadding ?? (kind() === 'context' ? 0 : 5);
    },
    get positionMethod() {
      return kind() === 'context' ? 'fixed' : (props.positionMethod ?? 'absolute');
    },
    get disableAnchorTracking() {
      return props.disableAnchorTracking ?? false;
    },
  };
  const placement = usePlacement(context.root, placementProps, {
    positioner: element,
    insets: () => !!context.viewport.value,
    lazyFlip: () => (context.filter ? 'placement' : false),
    shiftAcross: () => kind() === 'context' && props.collisionAvoidance?.side !== 'flip',
  });
  watch(
    [element, placement.placed],
    ([positioner, placed]) => {
      context.positioner.value = positioner;
      context.placed.value = placed;
    },
    { flush: 'sync', immediate: true },
  );
  onUnmounted(() => {
    context.positioner.value = null;
    context.placed.value = false;
  });
  provide(positionerKey, placement);

  const state = computed<MenuPositionerState>(() => ({
    open: context.root.open,
    side: placement.side.value,
    align: placement.align.value,
    anchorHidden: placement.anchorHidden.value,
    nested: kind() === 'submenu',
    instant: context.root.instant,
  }));

  return {
    state,
    attributes: () => ({
      style: [
        placement.style.value,
        sizeVariables('positioner', context.viewport.value?.positioner),
      ],
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-anchor-hidden': state.value.anchorHidden ? '' : undefined,
    }),
  };
}
