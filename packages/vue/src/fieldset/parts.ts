import FieldsetLegend from './FieldsetLegend.vue';
import FieldsetRoot from './FieldsetRoot.vue';
import type { FieldsetLegendProps, FieldsetRootProps, FieldsetRootState } from './types';

export const Root: typeof FieldsetRoot = FieldsetRoot;
export namespace Root {
  export type Props = FieldsetRootProps;
  export type State = FieldsetRootState;
}

export const Legend: typeof FieldsetLegend = FieldsetLegend;
export namespace Legend {
  export type Props = FieldsetLegendProps;
}
