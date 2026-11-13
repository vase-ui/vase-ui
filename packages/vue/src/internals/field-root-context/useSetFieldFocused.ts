import {
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
} from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useFieldRootContext } from './FieldRootContext';

/**
 * Returns the field's `setFocused`, recording which control the focused state belongs to.
 *
 * Disabling or unmounting a focused control moves focus away without firing `blur`, so the focused
 * state would otherwise stay latched. A field can have several focus targets, so a control only
 * clears the shared state when focus last landed on itself. The returned function doubles as that
 * identity.
 */
export function useSetFieldFocused(
  disabled: MaybeRefOrGetter<boolean | undefined>,
  focusTargetRef: MaybeRefOrGetter<Element | null>,
  onFocusedChange?: ((focused: boolean) => void) | undefined,
): (focused: boolean) => void {
  const context = useFieldRootContext();
  // The default context holds no state. With no field, the control keeps the owner itself.
  const focusOwnerRef = context.focusOwnerRef ?? shallowRef<unknown>();

  function setFieldFocused(focused: boolean) {
    // A disabled target can still be focused (`aria-disabled` elements stay programmatically
    // focusable), but must not publish the field's focused styling.
    if (focused ? !toValue(disabled) : focusOwnerRef.value === setFieldFocused) {
      focusOwnerRef.value = focused && setFieldFocused;
      onFocusedChange?.(focused);
      context.setFocused(focused);
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

  let wasDeactivated = false;
  onDeactivated(() => {
    wasDeactivated = true;
    releaseFocus();
  });
  onActivated(() => {
    if (wasDeactivated) {
      wasDeactivated = false;
      takeFocus();
    }
  });

  onScopeDispose(releaseFocus);

  return setFieldFocused;
}
