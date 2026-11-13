import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
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
  // `KeepAlive` removes the DOM of a deactivated control from the document, so the provider must
  // not keep its registration.
  let isDeactivated = false;

  function unregister() {
    if (!hasRegistered || registerControlId === NOOP) {
      return;
    }

    hasRegistered = false;
    registerControlId(source, undefined);
  }

  function register() {
    if (isDeactivated || !isEnabled() || registerControlId === NOOP) {
      unregister();
      return;
    }

    const explicitId = id();
    let nextId: string | null;

    if (explicitId !== undefined) {
      hadExplicitId = true;
      nextId = explicitId;
    } else if (hadExplicitId) {
      nextId = defaultId.value;
    } else {
      // A control with no id must claim the default id of the provider. Else the id of a control
      // that is gone stays selected.
      resetControlId();
      return;
    }

    hasRegistered = true;
    registerControlId(source, nextId);
  }

  // The registration waits for the mount. A server render never runs `onMounted`, and the first
  // render of a hydration must equal the server HTML.
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
    isDeactivated = true;
    unregister();
  });

  onActivated(() => {
    // `onActivated` also runs at the first mount inside `KeepAlive`, where `onMounted` registered.
    if (!isDeactivated) {
      return;
    }

    isDeactivated = false;
    if (isMounted) {
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
