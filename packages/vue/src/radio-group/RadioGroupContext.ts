import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { VaseUIChangeEventDetails } from '../internals/createVaseUIEventDetails';
import type { UseFieldValidationReturnValue } from '../internals/field-root-context/FieldRootContext';
import type { VaseUIEventReasons } from '../internals/reasons';

export interface RadioGroupContext<Value> {
  disabled: ComputedRef<boolean>;
  readOnly: ComputedRef<boolean>;
  required: ComputedRef<boolean>;
  form: ComputedRef<string | undefined>;
  name: ComputedRef<string | undefined>;
  checkedValue: Readonly<Ref<Value | undefined>>;
  setCheckedValue: (
    value: Value,
    eventDetails: VaseUIChangeEventDetails<VaseUIEventReasons['none']>,
  ) => void;
  touched: Readonly<Ref<boolean>>;
  setTouched: (touched: boolean) => void;
  validation: UseFieldValidationReturnValue;
  /**
   * Gives the hidden input of a radio to the group. The function that it returns removes the input
   * again.
   */
  registerInputRef: (element: HTMLInputElement) => () => void;
  /**
   * Counts the changes of the value that no listener cancelled. Each radio writes its state to its
   * input when the count changes. Base UI does not have this member.
   */
  inputSyncRequest: Readonly<Ref<number>>;
  /**
   * Asks each radio to take the state of its input, with the event of the request. The group sets
   * it at a form restore and in the take that `takeInputsAfterMount` queues. Base UI does not have
   * this member.
   */
  inputTakeRequest: Readonly<Ref<{ event?: Event | undefined } | undefined>>;
  /**
   * Queues one take of the inputs of the group after the mount. A radio whose input changed before
   * the hydration calls it. Base UI does not have this member.
   */
  takeInputsAfterMount: () => void;
  /**
   * Follows the native reset of the form of an input of the group. A radio calls it for each reset
   * that it gets. The group handles the first call for each `reset` event.
   */
  reset: (event: Event) => void;
}

export const RadioGroupContext: InjectionKey<RadioGroupContext<any>> = Symbol();

export function useRadioGroupContext<Value = any>(): RadioGroupContext<Value> | undefined {
  // The default `undefined` stops the Vue warning for a missing provider.
  // A radio with no group is valid, so this function does not throw.
  return inject(RadioGroupContext, undefined);
}
