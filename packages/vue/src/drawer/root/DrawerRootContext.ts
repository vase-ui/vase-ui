import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { DrawerRootSnapPointChangeEventDetails } from './DrawerRoot.vue';

export type DrawerSwipeDirection = 'up' | 'down' | 'left' | 'right';
export type DrawerSnapPoint = number | string;

export interface DrawerNestedSwipeProgressStore {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
}

export interface DrawerRootContext {
  swipeDirection: ComputedRef<DrawerSwipeDirection>;
  /**
   * Whether `Drawer.SwipeArea` is currently driving an open gesture (writing the popup's
   * swipe-movement vars imperatively). The viewport reads this to skip resetting them on open.
   */
  swipeAreaActiveRef: Ref<boolean>;
  /**
   * Whether to disable velocity-based snap skipping.
   */
  snapToSequentialPoints: ComputedRef<boolean>;
  /**
   * Snap points used to size/position the drawer.
   */
  snapPoints: ComputedRef<DrawerSnapPoint[] | undefined>;
  /**
   * The currently active snap point.
   */
  activeSnapPoint: ComputedRef<DrawerSnapPoint | null>;
  /**
   * Updates the currently active snap point.
   */
  setActiveSnapPoint: (
    snapPoint: DrawerSnapPoint | null,
    eventDetails?: DrawerRootSnapPointChangeEventDetails,
  ) => void;
  /**
   * The measured height of the frontmost open drawer within the current nested drawer stack.
   */
  frontmostHeight: Readonly<Ref<number>>;
  /**
   * The measured height of the drawer popup element.
   */
  popupHeight: Readonly<Ref<number>>;
  /**
   * Whether the current drawer has a nested drawer mounted in its stack (including while it is
   * transitioning out).
   */
  hasNestedDrawer: Readonly<Ref<boolean>>;
  /**
   * Called by the drawer popup to report its own measured height.
   */
  onPopupHeightChange: (height: number) => void;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  nestedSwiping: Readonly<Ref<boolean>>;
  /**
   * Provides nested swipe progress without re-rendering the drawer tree.
   */
  nestedSwipeProgressStore: DrawerNestedSwipeProgressStore;
  /**
   * Called by a nested drawer to report whether it is still present (open or transitioning out).
   */
  onNestedDrawerPresenceChange: (present: boolean) => void;
  /**
   * Called by a nested drawer to report the frontmost height of its own stack.
   */
  onNestedFrontmostHeightChange: (height: number) => void;
  /**
   * Called by a nested drawer to report whether it's being swiped.
   */
  onNestedSwipingChange: (swiping: boolean) => void;
  /**
   * Called by a nested drawer to report its swipe progress.
   */
  onNestedSwipeProgressChange: (progress: number) => void;
  /**
   * Provided to nested drawers so they can report their frontmost height to the parent drawer.
   */
  notifyParentFrontmostHeight?: ((height: number) => void) | undefined;
  /**
   * Provided to nested drawers so they can report swiping to the parent drawer.
   */
  notifyParentSwipingChange?: ((swiping: boolean) => void) | undefined;
  /**
   * Provided to nested drawers so they can report swipe progress to the parent drawer.
   */
  notifyParentSwipeProgressChange?: ((progress: number) => void) | undefined;
  /**
   * Provided to nested drawers so they can report whether they are still present (open or
   * transitioning out) to the parent drawer.
   */
  notifyParentHasNestedDrawer?: ((present: boolean) => void) | undefined;
}

export const DrawerRootContext: InjectionKey<DrawerRootContext> = Symbol();

export function useDrawerRootContext(optional?: false): DrawerRootContext;
export function useDrawerRootContext(optional: true): DrawerRootContext | undefined;
export function useDrawerRootContext(optional?: boolean) {
  const drawerRootContext = inject(DrawerRootContext, undefined);

  if (optional !== true && drawerRootContext === undefined) {
    throw new Error(
      'Vase UI: DrawerRootContext is missing. Without it a Drawer part has no drawer to read. Put the Drawer parts inside <Drawer.Root>.',
    );
  }

  return drawerRootContext;
}
