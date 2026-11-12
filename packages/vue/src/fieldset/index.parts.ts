import FieldsetLegend from './legend/FieldsetLegend.vue';
import type { FieldsetLegendProps, FieldsetLegendState } from './legend/FieldsetLegend.vue';
import FieldsetRoot from './root/FieldsetRoot.vue';
import type { FieldsetRootProps, FieldsetRootState } from './root/FieldsetRoot.vue';

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
 * An accessible label that is automatically associated with the fieldset.
 * Renders a `<div>` element.
 */
export const Legend: typeof FieldsetLegend = FieldsetLegend;
export namespace Legend {
  export type Props = FieldsetLegendProps;
  export type State = FieldsetLegendState;
}
