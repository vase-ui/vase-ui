import { computed, inject, onMounted, onScopeDispose, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { given } from '../givenAttributes';
import { useVaseUiId } from '../useVaseUiId';
import { useKeepAliveState } from '../useKeepAliveState';
import { LabelableContext } from './LabelableContext';
import { useRegisteredId } from './useRegisteredId';

/**
 * A control calls it in `setup` and binds the result to its `id`. The label of the same provider
 * then has the `for` that names the control.
 */
export function useLabelableId(params: UseLabelableIdParameters = {}): ComputedRef<string> {
  const context = inject(LabelableContext, null);
  const defaultId = useVaseUiId();
  const id = () => given('id', toValue(params.id));
  if (!context) {
    return computed(() => id() ?? defaultId.value);
  }

  const { controlId, registerControlId, resetControlId, registerControlElementId } = context;
  const source = Symbol();
  const isEnabled = () => toValue(params.enabled) ?? true;

  let hasRegistered = false;
  let hadExplicitId = false;
  // `KeepAlive` removes the DOM of a held control from the document, so the control gives no id
  // then. Its entry stays. `KeepAlive` runs the `onActivated` hooks of one branch from the last part
  // to the first part. A new entry in that hook would reverse the order of the controls.
  const { isHeld, shown } = useKeepAliveState();

  function getRegisteredId() {
    if (isHeld.value) {
      return undefined;
    }
    const explicitId = id();
    return explicitId === undefined ? defaultId.value : explicitId;
  }

  function unregister() {
    if (!hasRegistered) {
      return;
    }

    hasRegistered = false;
    registerControlId(source, undefined);
  }

  function register() {
    if (!isEnabled()) {
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
    watch([id, isEnabled], register, { immediate: true });
  });

  // A control with no id claims the default id of the provider again when `KeepAlive` shows it.
  // The claim waits for the flush after the hooks. In its own hook, the controls before it in the
  // branch are still held and give no id, so the claim would reset the selected id.
  watch(shown, register);

  // `onScopeDispose` runs while Vue unmounts the control. The `onMounted` of a control that
  // replaces it runs in the flush after that, so the new control never sees the old registration.
  onScopeDispose(unregister);

  // The id of the provider wins until the registration. The label has `for` with that id in the
  // server HTML. An id of the control here would leave the label and the control with two ids, and
  // a label that names no element names nothing.
  const boundId = computed(
    () => (isEnabled() ? controlId.value : undefined) ?? id() ?? defaultId.value,
  );

  if (params.element !== undefined) {
    useRegisteredId(
      () => (isEnabled() ? boundId.value : undefined),
      registerControlElementId,
      params.element,
    );
  }

  return boundId;
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
  /**
   * The element that has the `id` of the control. A `#render` slot can give it another `id`, and
   * the label then names that `id`. Give `null` while the `#render` slot does not render that
   * element, such as a checkbox with a hidden input.
   */
  element?: MaybeRefOrGetter<Element | null | undefined> | undefined;
}
