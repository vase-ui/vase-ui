import type { InjectionKey } from 'vue';
import type { FieldsetForPart } from './part';

/** What a `Fieldset.Root` gives to its legends. */
export interface FieldsetForLegend {
  /**
   * The answer for a part in the legend. A disabled root does not disable its legend, so the
   * answer comes from the fieldsets around the root.
   */
  readonly forParts: FieldsetForPart;
  /** Adds a legend. Returns the function that removes it. */
  addLegend(legend: { readonly id: string }): () => void;
}

export const legendKey: InjectionKey<FieldsetForLegend> = Symbol('fieldset legend');
