import type { InjectionKey } from 'vue';

/** What a `Fieldset.Root` gives to its legends. */
export interface FieldsetForLegend {
  /**
   * The id that the root names in its server HTML, while the root has no legend. A legend with no
   * `id` prop takes it, so that the server HTML of the root names that legend.
   */
  readonly firstLegendId: string | undefined;
  /** Adds a legend. Returns the function that removes it. */
  addLegend(legend: { readonly id: string }): () => void;
}

export const legendKey: InjectionKey<FieldsetForLegend> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'fieldset legend' : undefined,
);
