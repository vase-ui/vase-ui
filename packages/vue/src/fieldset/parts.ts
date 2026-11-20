import FieldsetLegend from './FieldsetLegend.vue';
import FieldsetRoot from './FieldsetRoot.vue';
import type { FieldsetLegendProps, FieldsetRootProps, FieldsetRootState } from './types';

/**
 * Groups a shared legend with related controls.
 * Renders a `<fieldset>` element.
 */
export const Root: typeof FieldsetRoot = FieldsetRoot;
export namespace Root {
  export type Props = FieldsetRootProps;
  export type State = FieldsetRootState;
}

/**
 * An accessible label for the fieldset.
 * Renders a `<div>` element.
 */
export const Legend: typeof FieldsetLegend = FieldsetLegend;
export namespace Legend {
  export type Props = FieldsetLegendProps;
}
