import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { VaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { VaseUIEventReasons } from '../internals/reasons';

export interface ToggleGroupContext<Value> {
  value: ComputedRef<readonly Value[]>;
  setGroupValue: (
    newValue: Value,
    nextPressed: boolean,
    eventDetails: VaseUIChangeEventDetails<VaseUIEventReasons['none']>,
  ) => void;
  disabled: ComputedRef<boolean>;
  /**
   * Whether the group got `value` or `defaultValue`.
   * A Toggle with no `value` prop reports an error only then.
   */
  isValueInitialized: ComputedRef<boolean>;
}

export const ToggleGroupContext: InjectionKey<ToggleGroupContext<any>> = Symbol();

export function useToggleGroupContext<Value>(): ToggleGroupContext<Value> | undefined {
  // The default `undefined` stops the Vue warning for a missing provider.
  // A Toggle with no group is valid, so this function does not throw.
  return inject(ToggleGroupContext, undefined);
}
