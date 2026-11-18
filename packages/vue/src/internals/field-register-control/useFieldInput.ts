import { inject, nextTick, shallowRef, watch } from 'vue';
import { comesBeforeInSameTree } from '../comesBeforeInSameTree';
import { FieldRootContext } from '../field-root-context/FieldRootContext';
import type { UseFieldValidationReturnValue } from '../field-root-context/FieldRootContext';
import { NOOP } from '../noop';
import { useKeepAliveState } from '../useKeepAliveState';

/** Validation uses this input when `registeredInputs` is empty. */
export function createFieldInputRegistry(): Pick<
  UseFieldValidationReturnValue,
  'inputRef' | 'setFieldInput'
> {
  const inputRef = shallowRef<HTMLInputElement | null>(null);
  const inputs: { source: symbol; input: HTMLInputElement }[] = [];
  let shown: Set<HTMLInputElement> | undefined;

  function setFieldInput(source: symbol, input: HTMLInputElement | null, atShow = false) {
    const previous = inputs.findIndex((entry) => entry.source === source);
    if (previous !== -1) {
      inputs.splice(previous, 1);
    }
    if (input) {
      let index = inputs.length;
      if (atShow) {
        // Controls from one activation keep document order after the inputs from earlier activations.
        if (!shown) {
          shown = new Set();
          void nextTick(() => {
            shown = undefined;
          });
        }
        while (index > 0) {
          const before = inputs[index - 1]?.input;
          if (!before || !shown.has(before) || !comesBeforeInSameTree(input, before)) {
            break;
          }
          index -= 1;
        }
        shown.add(input);
      }
      inputs.splice(index, 0, { source, input });
    }
    inputRef.value = inputs.at(-1)?.input ?? null;
  }

  return { inputRef, setFieldInput };
}

/** Gives the input to its field at the ref callback and releases it while KeepAlive holds the control. */
export function useFieldInput(): (input: HTMLElement | null) => void {
  const field = inject(FieldRootContext, null);
  if (!field) {
    return NOOP;
  }

  const { setFieldInput } = field.validation;
  const source = Symbol();
  const element = shallowRef<HTMLInputElement | null>(null);
  const { isHeld, shown } = useKeepAliveState();

  // A held control can mount or replace its element without another deactivation.
  watch([isHeld, element], ([held]) => {
    if (held) {
      setFieldInput(source, null);
    }
  });
  watch(shown, () => setFieldInput(source, element.value, true));

  return (node) => {
    const input = node as HTMLInputElement | null;
    setFieldInput(source, input);
    element.value = input;
  };
}
