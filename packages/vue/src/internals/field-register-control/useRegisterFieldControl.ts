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
import { useFieldRootContext } from '../field-root-context/FieldRootContext';
import type { FieldControlRegistration } from './useFieldControlRegistration';

/**
 * A control calls it in `setup`. The field gets the control, its `id`, its `name` and its value
 * from one getter. The getter returns the values of the moment of the read. The control registers
 * the getter again when its `id`, its `name`, its value or `enabled` changes. The field then uses
 * this control.
 */
export function useRegisterFieldControl(
  controlRef: FieldControlRegistration['controlRef'],
  id: MaybeRefOrGetter<FieldControlRegistration['id']>,
  value: () => FieldControlRegistration['value'],
  getFormValueOverride?: FieldControlRegistration['getValue'],
  enabled: MaybeRefOrGetter<boolean> = true,
  name?: MaybeRefOrGetter<FieldControlRegistration['name']>,
): void {
  const { registerFieldControl } = useFieldRootContext();
  const source = Symbol();
  // The two hooks only set a flag that the getter reads. The entry stays, and so does its place.
  // `KeepAlive` runs the `onActivated` hooks of one branch from the last part to the first part.
  // A new entry in that hook would reverse the order of the controls.
  const isDeactivated = shallowRef(false);

  onDeactivated(() => {
    isDeactivated.value = true;
  });

  onActivated(() => {
    isDeactivated.value = false;
  });

  const getId = () => toValue(id);
  const getName = () => toValue(name);
  const isEnabled = () => toValue(enabled);

  function getRegistration(): FieldControlRegistration | undefined {
    return isDeactivated.value || !isEnabled()
      ? undefined
      : {
          controlRef,
          getValue: getFormValueOverride,
          id: getId(),
          name: getName(),
          value: value(),
        };
  }

  let isMounted = false;

  // The registration waits for the mount. A lazy control runs its `setup` after its root hydrates,
  // and its `name` can add an element, such as the error of a form. A registration in `setup` would
  // then give a hydration mismatch. A server render never calls `onMounted`, so it writes to no
  // registry.
  onMounted(() => {
    isMounted = true;
    registerFieldControl(source, getRegistration);
  });

  // The registration effect of Base UI runs again on these four changes. A change before the mount
  // waits for the mount. The default flush runs before the DOM update. The field then drops the
  // work of the control that it replaces before this control starts work of its own.
  watch([getId, getName, value, isEnabled], () => {
    if (isMounted) {
      registerFieldControl(source, getRegistration);
    }
  });

  onScopeDispose(() => registerFieldControl(source, undefined));
}
