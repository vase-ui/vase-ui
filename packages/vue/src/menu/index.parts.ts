import MenuRoot from './root/MenuRoot.vue';
import type {
  MenuRootActions,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  MenuRootHighlightEventDetails,
  MenuRootHighlightEventReason,
  MenuRootOrientation,
  MenuRootProps,
  MenuRootState,
} from './root/MenuRoot.vue';

/**
 * Groups all parts of the menu.
 * Doesn't render its own HTML element.
 */
export const Root: typeof MenuRoot = MenuRoot;
export namespace Root {
  export type State = MenuRootState;
  export type Props<Payload = unknown> = MenuRootProps<Payload>;
  export type Actions = MenuRootActions;
  export type ChangeEventReason = MenuRootChangeEventReason;
  export type ChangeEventDetails = MenuRootChangeEventDetails;
  export type HighlightEventReason = MenuRootHighlightEventReason;
  export type HighlightEventDetails = MenuRootHighlightEventDetails;
  export type Orientation = MenuRootOrientation;
}

export { MenuHandle as Handle, createMenuHandle as createHandle } from './store/MenuHandle';
