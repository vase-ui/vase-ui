import ToolbarButton from './button/ToolbarButton.vue';
import type { ToolbarButtonProps, ToolbarButtonState } from './button/ToolbarButton.vue';
import ToolbarRoot from './root/ToolbarRoot.vue';
import type {
  ToolbarRootItemMetadata,
  ToolbarRootOrientation,
  ToolbarRootProps,
  ToolbarRootState,
} from './root/ToolbarRoot.vue';

/**
 * A container for grouping a set of controls, such as buttons, toggle groups, or menus.
 * Renders a `<div>` element.
 */
export const Root: typeof ToolbarRoot = ToolbarRoot;
export namespace Root {
  export type ItemMetadata = ToolbarRootItemMetadata;
  export type Orientation = ToolbarRootOrientation;
  export type Props = ToolbarRootProps;
  export type State = ToolbarRootState;
}

/**
 * A button that can be used as-is or as a trigger for other components.
 * Renders a `<button>` element.
 */
export const Button: typeof ToolbarButton = ToolbarButton;
export namespace Button {
  export type Props = ToolbarButtonProps;
  export type State = ToolbarButtonState;
}

export type { Orientation } from '../internals/types';
