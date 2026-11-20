import ButtonComponent from './Button.vue';
import type { ButtonProps, ButtonState } from './types';

/**
 * A button that starts an action.
 * Renders a `<button>` element.
 * @selector `:disabled` The button is disabled, and it is a native button that does not keep the focus.
 * @selector `[aria-disabled="true"]` The button is disabled, and it keeps the focus or is not a native button. `:enabled` also matches it, so select an enabled button with `:not(:disabled, [aria-disabled="true"])`.
 */
export const Button: typeof ButtonComponent = ButtonComponent;
export namespace Button {
  export type Props = ButtonProps;
  export type State = ButtonState;
}

export type { ButtonProps, ButtonState };
