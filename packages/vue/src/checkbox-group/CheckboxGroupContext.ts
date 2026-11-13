import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { VaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { UseFieldValidationReturnValue } from '../internals/field-root-context/FieldRootContext';
import type { LabelableContext } from '../internals/labelable-provider/LabelableContext';
import type { VaseUIEventReasons } from '../internals/reasons';
import type { UseCheckboxGroupParentReturnValue } from './useCheckboxGroupParent';

export interface CheckboxGroupContext {
  value: ComputedRef<string[]>;
  setValue: (
    value: string[],
    eventDetails: VaseUIChangeEventDetails<VaseUIEventReasons['none']>,
  ) => void;
  /**
   * The names of all checkboxes in the group. A group that has them has a parent checkbox.
   */
  allValues: ComputedRef<string[] | undefined>;
  parent: UseCheckboxGroupParentReturnValue;
  disabled: ComputedRef<boolean>;
  validation: UseFieldValidationReturnValue;
  /**
   * `registerControlId` of the labelable scope that the group renders in. A checkbox that sees the
   * same function shares that scope, so the group, not the checkbox, is the control of the field.
   */
  registerControlId: LabelableContext['registerControlId'];
  /**
   * Puts the group back to its default value after a native reset. Each checkbox of the group calls
   * it for the same `reset` event, and the first call does the work. Base UI does not have this
   * member.
   */
  reset: (event: Event) => void;
}

export const CheckboxGroupContext: InjectionKey<CheckboxGroupContext> = Symbol();

export function useCheckboxGroupContext(): CheckboxGroupContext | undefined {
  // The default `undefined` stops the Vue warning for a missing provider.
  // A checkbox with no group is valid, so this function does not throw.
  return inject(CheckboxGroupContext, undefined);
}
