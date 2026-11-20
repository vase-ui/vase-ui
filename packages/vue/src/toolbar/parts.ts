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
 * A container for a set of controls, such as buttons, toggle groups or menus. The toolbar is one
 * tab stop, so give no `tabindex` to a part. Remove an item with `v-if`, because an item that CSS
 * hides can still be the tab stop.
 * Renders a `<div>` element with the role `toolbar`.
 * @selector `[aria-orientation="vertical"]` The toolbar is vertical.
 * @selector `[data-disabled]` The toolbar is disabled.
 */
export const Root: typeof ToolbarRoot = ToolbarRoot;
export namespace Root {
  export type Props = ToolbarRootProps;
  export type State = ToolbarRootState;
  export type Orientation = ToolbarOrientation;
}

/**
 * Groups several toolbar items or toggles.
 * Renders a `<div>` element with the role `group`.
 * @selector `[data-orientation]` The orientation of the toolbar: `horizontal` or `vertical`.
 * @selector `[data-disabled]` The group or the toolbar is disabled.
 */
export const Group: typeof ToolbarGroup = ToolbarGroup;
export namespace Group {
  export type Props = ToolbarGroupProps;
  export type State = ToolbarGroupState;
}

/**
 * A button of the toolbar. Its `element` slot makes a trigger or a toggle an item of the toolbar.
 * Renders a `<button>` element.
 * @selector `[data-orientation]` The orientation of the toolbar: `horizontal` or `vertical`.
 * @selector `[aria-disabled="true"]` The button is disabled, and it keeps the focus or is not a native button.
 * @selector `:disabled` The button is a native button, it is disabled, and it does not keep the focus.
 */
export const Button: typeof ToolbarButton = ToolbarButton;
export namespace Button {
  export type Props = ToolbarButtonProps;
  export type State = ToolbarButtonState;
}

/**
 * A link of the toolbar. It is never disabled.
 * Renders an `<a>` element.
 * @selector `[data-orientation]` The orientation of the toolbar: `horizontal` or `vertical`.
 */
export const Link: typeof ToolbarLink = ToolbarLink;
export namespace Link {
  export type Props = ToolbarLinkProps;
  export type State = ToolbarLinkState;
}

/**
 * A text input of the toolbar. Its `element` slot makes another control an item of the toolbar.
 * A text input keeps ArrowLeft and ArrowRight while its caret can move.
 * Renders the `Input` part, an `<input>` element.
 * @selector `[data-orientation]` The orientation of the toolbar: `horizontal` or `vertical`.
 * @selector `[aria-disabled="true"]` The input is disabled and keeps the focus.
 * @selector `:disabled` The input is disabled and does not keep the focus.
 */
export const Input: typeof ToolbarInput = ToolbarInput;
export namespace Input {
  export type Props = ToolbarInputProps;
  export type State = ToolbarInputState;
}

/**
 * A separator of the toolbar, across the toolbar.
 * Renders the `Separator` part, a `<div>` element with the role `separator`.
 * @selector `[aria-orientation="vertical"]` The separator is vertical.
 */
export const Separator: typeof ToolbarSeparator = ToolbarSeparator;
export namespace Separator {
  export type Props = ToolbarSeparatorProps;
  export type State = ToolbarSeparatorState;
}
