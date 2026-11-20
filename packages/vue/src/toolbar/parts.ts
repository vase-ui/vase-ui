import ToolbarButton from './ToolbarButton.vue';
import ToolbarGroup from './ToolbarGroup.vue';
import ToolbarInput from './ToolbarInput.vue';
import ToolbarLink from './ToolbarLink.vue';
import ToolbarRoot from './ToolbarRoot.vue';
import ToolbarSeparator from './ToolbarSeparator.vue';
import type {
  ToolbarButtonProps,
  ToolbarButtonState,
  ToolbarGroupProps,
  ToolbarGroupState,
  ToolbarInputProps,
  ToolbarInputState,
  ToolbarLinkProps,
  ToolbarLinkState,
  ToolbarOrientation,
  ToolbarRootProps,
  ToolbarRootState,
  ToolbarSeparatorProps,
  ToolbarSeparatorState,
} from './types';

export type Orientation = ToolbarOrientation;

/**
 * A container for a set of controls, such as buttons, toggle groups or menus.
 * Renders a `<div>` element.
 */
export const Root: typeof ToolbarRoot = ToolbarRoot;
export namespace Root {
  export type Props = ToolbarRootProps;
  export type State = ToolbarRootState;
  export type Orientation = ToolbarOrientation;
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
 * A button of the toolbar. Its `element` slot makes a trigger or a toggle an item of the toolbar.
 * Renders a `<button>` element.
 */
export const Button: typeof ToolbarButton = ToolbarButton;
export namespace Button {
  export type Props = ToolbarButtonProps;
  export type State = ToolbarButtonState;
}

/**
 * A link of the toolbar.
 * Renders an `<a>` element.
 */
export const Link: typeof ToolbarLink = ToolbarLink;
export namespace Link {
  export type Props = ToolbarLinkProps;
  export type State = ToolbarLinkState;
}

/**
 * A text input of the toolbar. Its `element` slot makes another control an item of the toolbar.
 * Renders the `Input` part, an `<input>` element.
 */
export const Input: typeof ToolbarInput = ToolbarInput;
export namespace Input {
  export type Props = ToolbarInputProps;
  export type State = ToolbarInputState;
}

/**
 * A separator of the toolbar, across the toolbar.
 * Renders the `Separator` part, a `<div>` element.
 */
export const Separator: typeof ToolbarSeparator = ToolbarSeparator;
export namespace Separator {
  export type Props = ToolbarSeparatorProps;
  export type State = ToolbarSeparatorState;
}
