import type { ComputedRef } from 'vue';
import { NOOP } from '../noop';
import { useLabelableContext } from './LabelableContext';
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
  const { labelId, registerLabelId } = useLabelableContext();

  // A control with no provider has no label to wait for.
  if (registerLabelId !== NOOP) {
    useDeferredServerRender();
  }

  return labelId;
}
