import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { useLabelableContext } from './LabelableContext';

/**
 * A control whose element is not a labelable element of HTML calls it, such as a `<span>` with a
 * role. The `for` of a label does not name such a control, so the control binds the result to
 * `aria-labelledby`.
 *
 * A server render writes the attributes of the control before the `setup` of a label that comes
 * after it. Until the control is mounted, the result is the id that the provider made for the label.
 * The server HTML then names the control, in each order of the two parts.
 * The control holds this state and the provider does not, because a control can hydrate after its
 * provider.
 *
 * After the mount, the result is the id that a label registered. It is `undefined` when the field
 * has no label.
 */
export function useControlLabelId(): ComputedRef<string | undefined> {
  const { labelId, defaultLabelId } = useLabelableContext();
  const isHydrating = useIsHydrating();

  return computed(() => labelId.value ?? (isHydrating.value ? defaultLabelId.value : undefined));
}
