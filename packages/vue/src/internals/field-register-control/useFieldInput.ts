import { inject, nextTick, shallowRef, watch } from 'vue';
import type { ShallowRef } from 'vue';
import { comesBeforeInSameTree } from '../comesBeforeInSameTree';
import { NOOP } from '../noop';
import { FieldRootContext } from '../field-root-context/FieldRootContext';
import { useKeepAliveState } from '../useKeepAliveState';

// The inputs of the controls of one field, in the order in which each control gave its input last.
// The inputs that one show gives are in document order.
// React attaches the refs of a branch that `Activity` shows in tree order, so the last input of
// that branch wins there too.
// The key is `validation.inputRef` of the field, so the list goes away with the field.
const inputsOfField = new WeakMap<ShallowRef<HTMLInputElement | null>, HTMLInputElement[]>();
// The inputs that the controls of one field gave again in the flush of a show.
const shownInputsOfField = new WeakMap<
  ShallowRef<HTMLInputElement | null>,
  Set<HTMLInputElement>
>();

/**
 * Gives the input of a control to its field. Call it in `setup`. Call the result in the `ref`
 * setter of the input each time the input changes, with the element or `null`.
 *
 * The field validates the last input that a control gave. It does not validate the input of a
 * control that `KeepAlive` holds. When `KeepAlive` shows the control again, the control gives its
 * input again. The inputs of one show go to the field in document order. When the last input goes,
 * the field validates the input before it. A template can mount a new control before it unmounts
 * the control that the new control replaces, and the new input then stays last.
 */
export function useFieldInput(): (input: HTMLElement | null) => void {
  const field = inject(FieldRootContext, null);
  if (!field) {
    return NOOP;
  }

  const { inputRef } = field.validation;
  const inputs = inputsOfField.get(inputRef) ?? [];
  inputsOfField.set(inputRef, inputs);

  // Vue calls the setter during the render of the control. A read of a ref there would make that
  // render depend on the ref, so the setter reads this variable and reads no ref.
  let ownInput: HTMLInputElement | null = null;
  const element = shallowRef<HTMLInputElement | null>(null);
  const { isHeld, shown } = useKeepAliveState();

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

  // The watchers of one show run in the order in which Vue made the controls. A control that a
  // branch made later can come before an older control in the document. The input thus goes
  // before each input of the same show that comes after it in the document.
  function giveAtShow() {
    release();
    if (ownInput) {
      let shownInputs = shownInputsOfField.get(inputRef);
      if (!shownInputs) {
        shownInputs = new Set();
        shownInputsOfField.set(inputRef, shownInputs);
        void nextTick(() => shownInputsOfField.delete(inputRef));
      }
      let index = inputs.length;
      while (index > 0) {
        const previous = inputs[index - 1];
        if (!previous || !shownInputs.has(previous) || !comesBeforeInSameTree(ownInput, previous)) {
          break;
        }
        index -= 1;
      }
      inputs.splice(index, 0, ownInput);
      shownInputs.add(ownInput);
    }
    update();
  }

  watch(shown, giveAtShow);

  return (input) => {
    release();
    ownInput = input as HTMLInputElement | null;
    give();
    element.value = ownInput;
  };
}
