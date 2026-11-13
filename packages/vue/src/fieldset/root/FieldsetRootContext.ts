import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { LabelIdSetter } from '../../utils/useRegisteredLabelId';

export interface FieldsetRootContext {
  /**
   * The id of the legend that the root has now. It is `undefined` when the root has no legend.
   */
  legendId: ComputedRef<string | undefined>;
  setLegendId: LabelIdSetter;
  defaultLegendId: ComputedRef<string>;
  disabled: ComputedRef<boolean>;
}

export const FieldsetRootContext: InjectionKey<FieldsetRootContext> = Symbol();

export function useFieldsetRootContext(optional: true): FieldsetRootContext | undefined;
export function useFieldsetRootContext(optional?: false): FieldsetRootContext;
export function useFieldsetRootContext(optional = false) {
  // With one argument, Vue shows a warning when there is no provider.
  // An outermost root has none by design, and a part gets the error below, which says more.
  const context = inject(FieldsetRootContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: A part of Fieldset must be inside <Fieldset.Root>. Without a root the legend has no fieldset to name. Put the part inside <Fieldset.Root>.',
    );
  }

  return context;
}
