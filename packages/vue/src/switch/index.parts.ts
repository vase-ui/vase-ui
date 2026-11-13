import SwitchRoot from './root/SwitchRoot.vue';
import type {
  SwitchRootChangeEventDetails,
  SwitchRootChangeEventReason,
  SwitchRootProps,
  SwitchRootState,
} from './root/SwitchRoot.vue';
import SwitchThumb from './thumb/SwitchThumb.vue';
import type { SwitchThumbProps, SwitchThumbState } from './thumb/SwitchThumb.vue';

/**
 * Represents the switch itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * The part has more than one root node. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Root: typeof SwitchRoot = SwitchRoot;
export namespace Root {
  export type State = SwitchRootState;
  export type Props = SwitchRootProps;
  export type ChangeEventReason = SwitchRootChangeEventReason;
  export type ChangeEventDetails = SwitchRootChangeEventDetails;
}

/**
 * The movable part of the switch that indicates whether the switch is on or off.
 * Renders a `<span>`.
 */
export const Thumb: typeof SwitchThumb = SwitchThumb;
export namespace Thumb {
  export type Props = SwitchThumbProps;
  export type State = SwitchThumbState;
}
