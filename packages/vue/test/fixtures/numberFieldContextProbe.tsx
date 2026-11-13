import { defineComponent } from 'vue';
import { useValueChanged } from '../../src/internals/useValueChanged';
import { useNumberFieldRootContext } from '../../src/number-field/root/NumberFieldRootContext';
import type { NumberFieldRootContext } from '../../src/number-field/root/NumberFieldRootContext';

/**
 * Makes a part that stands in for `NumberField.Input`. It renders a text input with the element
 * ref, the `inputmode`, the text and the wheel listener that the context gives, and it has the test
 * id `text`. `getContext` gives the test the context of the root.
 * @param onValueChanged Runs after the DOM update of each change of the value, as the callback of
 * `useValueChanged` in a part.
 */
export function defineNumberFieldContextProbe(
  onValueChanged?: (context: NumberFieldRootContext) => void,
) {
  let context: NumberFieldRootContext | undefined;

  const Probe = defineComponent(() => {
    context = useNumberFieldRootContext();
    const { inputRef, inputMode, isWheelScrubEnabled, onInputWheel, state } = context;
    if (onValueChanged) {
      useValueChanged(
        () => state.value.value,
        () => onValueChanged(context!),
      );
    }
    function setInputRef(element: unknown) {
      inputRef.value = element as HTMLInputElement | null;
    }
    return () => (
      <input
        ref={setInputRef}
        data-testid="text"
        inputmode={inputMode.value}
        value={state.value.inputValue}
        onWheel={isWheelScrubEnabled.value ? onInputWheel : undefined}
      />
    );
  });

  return { Probe, getContext: () => context as NumberFieldRootContext };
}
