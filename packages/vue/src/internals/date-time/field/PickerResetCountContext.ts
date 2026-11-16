import type { InjectionKey, Ref } from 'vue';

/**
 * The count of the native resets that a picker put back to its default value.
 * `useDateTimePickerRoot` provides it to the field roots below the picker. The picker gives the new
 * value of a reset to such a root with the next render, so the root reads the count to tell that
 * value from the value of a user.
 */
export const PickerResetCountContext: InjectionKey<Readonly<Ref<number>>> = Symbol();
