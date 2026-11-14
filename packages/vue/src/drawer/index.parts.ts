import DrawerRoot from './root/DrawerRoot.vue';
import type {
  DrawerRootActions,
  DrawerRootChangeEventDetails,
  DrawerRootChangeEventReason,
  DrawerRootProps,
  DrawerRootSnapPointChangeEventDetails,
  DrawerRootSnapPointChangeEventReason,
  DrawerRootState,
} from './root/DrawerRoot.vue';
import type { DrawerSnapPoint } from './root/DrawerRootContext';

/**
 * Groups all parts of the drawer.
 * Doesn't render its own HTML element.
 */
export const Root: typeof DrawerRoot = DrawerRoot;
export namespace Root {
  export type State = DrawerRootState;
  export type Props<Payload = unknown> = DrawerRootProps<Payload>;
  export type Actions = DrawerRootActions;
  export type ChangeEventReason = DrawerRootChangeEventReason;
  export type ChangeEventDetails = DrawerRootChangeEventDetails;
  export type SnapPointChangeEventReason = DrawerRootSnapPointChangeEventReason;
  export type SnapPointChangeEventDetails = DrawerRootSnapPointChangeEventDetails;
  export type SnapPoint = DrawerSnapPoint;
}

export { createDrawerHandle as createHandle, DrawerHandle as Handle } from './handle';
