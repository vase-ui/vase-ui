import { watch } from 'vue';
import type { Ref } from 'vue';

/**
 * Vue skips `checked` at hydration and writes it only when it changes between renders.
 * A click can change the input when the parent keeps its state. It also clears `indeterminate`,
 * which has no HTML attribute.
 */
export function useCheckedInputSync(
  input: Readonly<Ref<HTMLInputElement | null>>,
  checked: () => boolean,
  { indeterminate, take }: { indeterminate?: () => boolean; take?: () => void } = {},
) {
  function write() {
    const element = input.value;
    if (!element) {
      return;
    }
    const state = checked();
    if (element.checked !== state) {
      // eslint-disable-next-line no-restricted-syntax -- A click can change the input without a render.
      element.checked = state;
    }
    const mixed = indeterminate?.();
    if (mixed !== undefined && element.indeterminate !== mixed) {
      // eslint-disable-next-line no-restricted-syntax -- A click clears this property before the part handles it.
      element.indeterminate = mixed;
    }
  }

  watch(
    input,
    (element) => {
      if (!element) {
        return;
      }
      // Vue also sets the attribute, so a difference here predates the hydration.
      if (take && element.checked !== element.defaultChecked) {
        take();
      } else {
        write();
      }
    },
    { flush: 'post' },
  );
  if (indeterminate) {
    watch(indeterminate, write, { flush: 'post' });
  }

  return { write };
}
