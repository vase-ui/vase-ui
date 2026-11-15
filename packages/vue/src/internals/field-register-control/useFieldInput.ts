import { shallowRef, watch } from 'vue';
import type { ShallowRef } from 'vue';
import { NOOP } from '../noop';
import { useFieldRootContext } from '../field-root-context/FieldRootContext';
import { useKeepAliveState } from '../useKeepAliveState';

// The inputs of the controls of one field, in the order in which each control gave its input last.
// The key is `validation.inputRef` of the field, so the list goes away with the field.
const inputsOfField = new WeakMap<ShallowRef<HTMLInputElement | null>, HTMLInputElement[]>();

/**
 * Gives the input of a control to its field. Call it in `setup`. Call the result in the `ref`
 * setter of the input each time the input changes, with the element or `null`.
 *
 * The field validates the last input that a control gave. It does not validate the input of a
 * control that `KeepAlive` holds. When `KeepAlive` shows the control again, the control gives its
 * input again. When the last input goes, the field validates the input before it. A template can
 * mount a new control before it unmounts the control that the new control replaces, and the new
 * input then stays last.
 */
export function useFieldInput(): (input: HTMLElement | null) => void {
  const { validation, reaches, setValidityData } = useFieldRootContext();
  // With no field, `validation.inputRef` drops each write, so there is nothing to keep.
  if (setValidityData === NOOP) {
    return NOOP;
  }

  const { inputRef } = validation;
  const inputs = inputsOfField.get(inputRef) ?? [];
  inputsOfField.set(inputRef, inputs);

  // Vue calls the setter during the render of the control. A read of a ref there would make that
  // render depend on the ref, so the setter reads this variable and reads no ref.
  let ownInput: HTMLInputElement | null = null;
  const element = shallowRef<HTMLInputElement | null>(null);
  const { isHeld, shown } = useKeepAliveState(element, reaches);

  function release() {
    const index = ownInput ? inputs.indexOf(ownInput) : -1;
    if (index !== -1) {
      inputs.splice(index, 1);
    }
  }

  function update() {
    inputRef.value = inputs.at(-1) ?? null;
  }

  function give() {
    release();
    if (ownInput) {
      inputs.push(ownInput);
    }
    update();
  }

  // `KeepAlive` calls no `ref` setter at a deactivation. A held control still calls its setter at a
  // mount in a held branch and when its element changes. The input of that control leaves the list
  // here.
  watch([isHeld, element], ([held]) => {
    if (held) {
      release();
      update();
    }
  });

  // `KeepAlive` runs the `onActivated` hooks from the last part to the first part. A `watch` runs in
  // the order of the parts, so the last control of the branch gives its input last.
  watch(shown, give);

  return (input) => {
    release();
    ownInput = input as HTMLInputElement | null;
    give();
    element.value = ownInput;
  };
}
