import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
} from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { NOOP } from '../noop';
import { useVaseUiId } from '../useBaseUiId';
import { useLabelableContext } from './LabelableContext';

/**
 * A control calls it in `setup` and binds the result to its `id`. The label of the same provider
 * then has the `for` that names the control.
 */
export function useLabelableId(params: UseLabelableIdParameters = {}): ComputedRef<string> {
  const { controlId, registerControlId, resetControlId } = useLabelableContext();

  const defaultId = useVaseUiId();

  const source = Symbol();
  const id = () => toValue(params.id);
  const isEnabled = () => toValue(params.enabled) ?? true;

  let hasRegistered = false;
  let hadExplicitId = false;
  let isMounted = false;
  // `KeepAlive` removes the DOM of a deactivated control from the document, so the control gives no
  // id then. Its entry stays. `KeepAlive` runs the `onActivated` hooks of one branch from the last
  // part to the first part. A new entry in that hook would reverse the order of the controls.
  const isDeactivated = shallowRef(false);

  function getRegisteredId() {
    if (isDeactivated.value) {
      return undefined;
    }
    const explicitId = id();
    return explicitId === undefined ? defaultId.value : explicitId;
  }

  function unregister() {
    if (!hasRegistered || registerControlId === NOOP) {
      return;
    }

    hasRegistered = false;
    registerControlId(source, undefined);
  }

  function register() {
    if (!isEnabled() || registerControlId === NOOP) {
      unregister();
      return;
    }

    if (id() !== undefined) {
      hadExplicitId = true;
    }

    if (!hadExplicitId) {
      // A control with no id must claim the default id of the provider. Else the id of a control
      // that is gone stays selected.
      resetControlId();
      return;
    }

    if (!hasRegistered) {
      hasRegistered = true;
      registerControlId(source, getRegisteredId);
    }
  }

  // The registration waits for the mount. The `setup` of a replacement can run before Vue removes or
  // deactivates the old control. The old registration is still there then.
  onMounted(() => {
    isMounted = true;
    register();
  });

  // A change before the mount also waits, for the same reason.
  watch([id, isEnabled], () => {
    if (isMounted) {
      register();
    }
  });

  onDeactivated(() => {
    isDeactivated.value = true;
  });

  onActivated(() => {
    isDeactivated.value = false;
  });

  // A control with no id claims the default id of the provider again when `KeepAlive` activates it.
  // The claim waits for the flush after the hooks. In the hook of this control, the controls before
  // it in the branch are still deactivated and give no id. The claim then resets the selected id.
  watch(isDeactivated, (deactivated) => {
    if (!deactivated) {
      register();
    }
  });

  // `onScopeDispose` runs while Vue unmounts the control. The `onMounted` of a control that
  // replaces it runs in the flush after that, so the new control never sees the old registration.
  onScopeDispose(unregister);

  // The id of the provider wins until the registration. The label has `for` with that id in the
  // server HTML. An id of the control here would leave the label and the control with two ids, and
  // a label that names no element names nothing.
  return computed(() => (isEnabled() ? controlId.value : undefined) ?? id() ?? defaultId.value);
}

export interface UseLabelableIdParameters {
  /**
   * The `id` of the control. Pass `null` for a control that takes its name from `aria-labelledby`
   * instead, so that the label omits `for`.
   */
  id?: MaybeRefOrGetter<string | null | undefined> | undefined;
  /**
   * Whether the control owns the label association of its labelable scope.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined> | undefined;
}
