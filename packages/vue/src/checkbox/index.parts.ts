import CheckboxIndicator from './indicator/CheckboxIndicator.vue';
import type {
  CheckboxIndicatorProps,
  CheckboxIndicatorState,
} from './indicator/CheckboxIndicator.vue';
import CheckboxRoot from './root/CheckboxRoot.vue';
import type {
  CheckboxRootChangeEventDetails,
  CheckboxRootChangeEventReason,
  CheckboxRootProps,
  CheckboxRootState,
} from './root/CheckboxRoot.vue';

/**
 * Represents the checkbox itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * The part has more than one root node. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Root: typeof CheckboxRoot = CheckboxRoot;
export namespace Root {
  export type State = CheckboxRootState;
  export type Props = CheckboxRootProps;
  export type ChangeEventReason = CheckboxRootChangeEventReason;
  export type ChangeEventDetails = CheckboxRootChangeEventDetails;
}

/**
 * Indicates whether the checkbox is ticked.
 * Renders a `<span>` element.
 */
export const Indicator: typeof CheckboxIndicator = CheckboxIndicator;
export namespace Indicator {
  export type State = CheckboxIndicatorState;
  export type Props = CheckboxIndicatorProps;
}
