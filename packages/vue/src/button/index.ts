import ButtonComponent from './Button.vue';
import type { ButtonProps, ButtonState } from './types';

export const Button: typeof ButtonComponent = ButtonComponent;
export namespace Button {
  export type Props = ButtonProps;
  export type State = ButtonState;
}

export type { ButtonProps, ButtonState };
