import { onActivated, onDeactivated, onMounted, onScopeDispose, shallowRef, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useFieldRootContext } from '../field-root-context/FieldRootContext';
import type { FieldControlRegistration } from './useFieldControlRegistration';

/**
 * A control calls it in `setup`. The field gets the control, its `id`, its `name` and its value
 * from one getter. The getter returns the values of the moment of the read, so a change of a value
 * needs no new registration.
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

  // The registration waits for the mount. A lazy control runs its `setup` after its root hydrates,
  // and its `name` can add an element, such as the error of a form. A registration in `setup` would
  // then give a hydration mismatch. A server render never calls `onMounted`, so it writes to no
  // registry.
  onMounted(() => {
    registerFieldControl(source, () =>
      isDeactivated.value || !toValue(enabled)
        ? undefined
        : {
            controlRef,
            getValue: getFormValueOverride,
            id: toValue(id),
            name: toValue(name),
            value: value(),
          },
    );
  });

  onScopeDispose(() => registerFieldControl(source, undefined));
}
