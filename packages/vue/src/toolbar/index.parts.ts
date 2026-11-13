import ToolbarButton from './button/ToolbarButton.vue';
import type { ToolbarButtonProps, ToolbarButtonState } from './button/ToolbarButton.vue';
import ToolbarGroup from './group/ToolbarGroup.vue';
import type { ToolbarGroupProps, ToolbarGroupState } from './group/ToolbarGroup.vue';
import ToolbarInput from './input/ToolbarInput.vue';
import type { ToolbarInputProps, ToolbarInputState } from './input/ToolbarInput.vue';
import ToolbarLink from './link/ToolbarLink.vue';
import type { ToolbarLinkProps, ToolbarLinkState } from './link/ToolbarLink.vue';
import ToolbarRoot from './root/ToolbarRoot.vue';
import type {
  ToolbarRootItemMetadata,
  ToolbarRootOrientation,
  ToolbarRootProps,
  ToolbarRootState,
} from './root/ToolbarRoot.vue';
import ToolbarSeparator from './separator/ToolbarSeparator.vue';
import type {
  ToolbarSeparatorProps,
  ToolbarSeparatorState,
} from './separator/ToolbarSeparator.vue';

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 */
export const Separator: typeof ToolbarSeparator = ToolbarSeparator;
export namespace Separator {
  export type Props = ToolbarSeparatorProps;
  export type State = ToolbarSeparatorState;
}

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
 * Groups several toolbar items or toggles.
 * Renders a `<div>` element.
 */
export const Group: typeof ToolbarGroup = ToolbarGroup;
export namespace Group {
  export type Props = ToolbarGroupProps;
  export type State = ToolbarGroupState;
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

/**
 * A link component.
 * Renders an `<a>` element.
 */
export const Link: typeof ToolbarLink = ToolbarLink;
export namespace Link {
  export type Props = ToolbarLinkProps;
  export type State = ToolbarLinkState;
}

/**
 * A native input element that integrates with Toolbar keyboard navigation.
 * Renders an `<input>` element.
 */
export const Input: typeof ToolbarInput = ToolbarInput;
export namespace Input {
  export type Props = ToolbarInputProps;
  export type State = ToolbarInputState;
}

export type { Orientation } from '../internals/types';
