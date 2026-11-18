import { computed, inject, onMounted, onScopeDispose, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { given } from '../givenAttributes';
import { useVaseUiId } from '../useVaseUiId';
import { useKeepAliveState } from '../useKeepAliveState';
import { LabelableContext } from './LabelableContext';
import { useRegisteredId } from './useRegisteredId';

/**
 * A control calls it in `setup` and binds the result to its `id`. The label uses this id for its control.
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
  // A held control keeps its place. Activation hooks can run in reverse document order.
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

  // A replacement can enter setup before the previous control releases its id.
  onMounted(() => {
    watch([id, isEnabled], register, { immediate: true });
  });

  // Wait until every control in the branch has its id again.
  watch(shown, register);

  onScopeDispose(unregister);

  // Before mount, the control must match the id in the server label's for attribute.
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
