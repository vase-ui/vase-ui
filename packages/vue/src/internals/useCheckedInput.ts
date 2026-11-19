import { computed, nextTick, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { queueInputTake } from '../common/hydration';
import { dispatchClickWithModifiers } from '../utils/dispatchClickWithModifiers';
import { handleHiddenInputInvalid } from './handleHiddenInputInvalid';
import { useFormRestore } from './useFormRestore';

interface CheckedInputOptions {
  checked: MaybeRefOrGetter<boolean>;
  indeterminate?: MaybeRefOrGetter<boolean>;
  acceptClick: (checked: boolean, event: MouseEvent) => boolean;
  takeRestored?: (checked: boolean, event?: Event) => void;
}

export function useCheckedInput(
  input: Readonly<Ref<HTMLInputElement | null>>,
  control: MaybeRefOrGetter<HTMLElement | null>,
  { checked, indeterminate, acceptClick, takeRestored }: CheckedInputOptions,
) {
  function restoreInput() {
    const node = input.value;
    if (!node) return;
    const value = toValue(checked);
    if (node.checked !== value) {
      // eslint-disable-next-line no-restricted-syntax -- Vue skips an equal checked value after a native click.
      node.checked = value;
    }
    const mixed = toValue(indeterminate);
    if (mixed !== undefined && node.indeterminate !== mixed) {
      // eslint-disable-next-line no-restricted-syntax -- A native click clears the mixed state before Vue can compare it.
      node.indeterminate = mixed;
    }
  }

  if (takeRestored) {
    const takeInput = (event?: Event) => {
      const node = input.value;
      if (!node) return;
      if (node.checked !== toValue(checked)) takeRestored(node.checked, event);
      void nextTick(restoreInput);
    };

    watch(
      input,
      (node) => {
        if (node && node.checked !== node.defaultChecked) {
          // The field must register its initial value before it receives a pre-hydration edit.
          queueInputTake(() => {
            takeInput();
            return true;
          });
        } else {
          restoreInput();
        }
      },
      { flush: 'post' },
    );
    useFormRestore(input, takeInput);
  }

  function activate(event: MouseEvent) {
    event.preventDefault();
    const node = input.value;
    // A Vapor ref can receive the input before insertion, even in a detached app.
    if (node?.parentNode) dispatchClickWithModifiers(node, event);
  }

  function onInputClick(event: MouseEvent) {
    event.stopPropagation();
    if (event.defaultPrevented) return;
    if (!acceptClick((event.currentTarget as HTMLInputElement).checked, event)) {
      event.preventDefault();
      return;
    }
    // A parent can keep its value after it receives the update.
    void nextTick(restoreInput);
  }

  return {
    // A direct checked prop overwrites a native edit during hydration. Vapor also inlines a literal object.
    checkedProps: computed(() => ({ checked: toValue(checked) })),
    activate,
    onInputClick,
    onInputFocus() {
      toValue(control)?.focus();
    },
    onInputInvalid: handleHiddenInputInvalid,
    restoreInput,
  };
}
