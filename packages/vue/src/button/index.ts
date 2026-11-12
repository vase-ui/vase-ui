import ButtonComponent from './Button.vue';
import type { ButtonProps, ButtonState } from './Button.vue';

/**
 * A button component that can be used to trigger actions.
 * Renders a `<button>` element.
 */
export const Button: typeof ButtonComponent = ButtonComponent;
export namespace Button {
  export type Props = ButtonProps;
  export type State = ButtonState;
}

export type * from './Button.vue';

export * as ButtonDataAttributes from './ButtonDataAttributes';
