import RadioIndicator from './indicator/RadioIndicator.vue';
import type { RadioIndicatorProps, RadioIndicatorState } from './indicator/RadioIndicator.vue';
import RadioRoot from './root/RadioRoot.vue';
import type { RadioRootProps, RadioRootState } from './root/RadioRoot.vue';

/**
 * Represents the radio button itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * The part has more than one root node. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Root: typeof RadioRoot = RadioRoot;
export namespace Root {
  export type State = RadioRootState;
  export type Props<Value = any> = RadioRootProps<Value>;
}

/**
 * Indicates whether the radio button is selected.
 * Renders a `<span>` element.
 */
export const Indicator: typeof RadioIndicator = RadioIndicator;
export namespace Indicator {
  export type Props = RadioIndicatorProps;
  export type State = RadioIndicatorState;
}
