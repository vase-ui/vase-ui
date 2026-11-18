import { computed, inject } from 'vue';
import type { ComputedRef } from 'vue';
import { LabelableContext } from './LabelableContext';
import { useDeferredServerRender } from './useDeferredServerRender';

/**
 * A control whose element is not a labelable element of HTML calls it, such as a `<span>` with a
 * role. The `for` of a label does not name such a control, so the control binds the result to
 * `aria-labelledby`.
 *
 * The result is the id of the registered label. It is `undefined` when the field has no label.
 * A control with a provider defers its server render, so the result names a label that comes after
 * the control, also in the server HTML.
 */
export function useControlLabelId(): ComputedRef<string | undefined> {
  const context = inject(LabelableContext, null);
  if (!context) {
    return computed(() => undefined);
  }

  useDeferredServerRender();
  return context.labelId;
}
