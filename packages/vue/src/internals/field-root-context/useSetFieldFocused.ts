import { inject, onMounted, onScopeDispose, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useKeepAliveState } from '../useKeepAliveState';
import { FieldRootContext } from './FieldRootContext';

export function createFieldFocusOwner(): FieldRootContext['setFocusOwner'] {
  let owner: symbol | undefined;
  return (source, focused) => {
    if (!focused && source !== owner) {
      return false;
    }
    owner = focused ? source : undefined;
    return true;
  };
}

/** Only the control that last took focus can release the field's focused state. */
export function useSetFieldFocused(
  disabled: MaybeRefOrGetter<boolean | undefined>,
  focusTargetRef: MaybeRefOrGetter<Element | null>,
  onFocusedChange?: (focused: boolean) => void,
): (focused: boolean) => void {
  const field = inject(FieldRootContext, null);
  const setFocusOwner = field?.setFocusOwner ?? createFieldFocusOwner();
  const source = Symbol();

  function setFieldFocused(focused: boolean) {
    if ((!focused || !toValue(disabled)) && setFocusOwner(source, focused)) {
      onFocusedChange?.(focused);
      field?.setFocused(focused);
    }
  }

  // Takes back a focus that no focus event reported: a control focused before hydration, or an
  // `aria-disabled` control re-enabled while it kept focus.
  function takeFocus() {
    const element = toValue(focusTargetRef);
    const root = element?.getRootNode() as Document | ShadowRoot | undefined;
    if (root?.activeElement === element) {
      setFieldFocused(true);
    }
  }

  function releaseFocus() {
    setFieldFocused(false);
  }

  onMounted(takeFocus);

  // A focused control releases the field when `disabled` changes, even when the browser does not
  // fire `blur`.
  watch(
    () => toValue(disabled),
    () => {
      releaseFocus();
      takeFocus();
    },
    { flush: 'post' },
  );

  const { isHeld } = useKeepAliveState();
  watch(isHeld, (held) => (held ? releaseFocus() : takeFocus()), { flush: 'sync' });

  onScopeDispose(releaseFocus);

  return setFieldFocused;
}
