import FieldsetLegend from './FieldsetLegend.vue';
import FieldsetRoot from './FieldsetRoot.vue';
import type { FieldsetLegendProps, FieldsetRootProps, FieldsetRootState } from './types';

/**
 * Groups a shared legend with related controls.
 * Renders a `<fieldset>` element.
 * @selector `:disabled` The fieldset is disabled.
 * @selector `[data-disabled]` The fieldset is disabled, and the `element` slot renders another element than a `<fieldset>`.
 */
export const Root: typeof FieldsetRoot = FieldsetRoot;
export namespace Root {
  export type Props = FieldsetRootProps;
  export type State = FieldsetRootState;
}

/**
 * An accessible label for the fieldset. The fieldset has the `id` of its first legend in
 * `aria-labelledby`. A group in the fieldset with no other label, such as a `RadioGroup`, has it
 * too.
 * Renders a `<div>` element.
 */
export const Legend: typeof FieldsetLegend = FieldsetLegend;
export namespace Legend {
  export type Props = FieldsetLegendProps;
}
