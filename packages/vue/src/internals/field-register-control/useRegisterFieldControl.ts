import { inject, onMounted, onScopeDispose, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { FieldRootContext } from '../field-root-context/FieldRootContext';
import { useKeepAliveState } from '../useKeepAliveState';
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
  const field = inject(FieldRootContext, null);
  if (!field) {
    return;
  }

  const { registerFieldControl } = field;
  const source = Symbol();
  // The getter reads the state, and the entry keeps its place. `KeepAlive` runs the `onActivated`
  // hooks of one branch from the last part to the first part. A new entry in that hook would
  // reverse the order of the controls.
  const { isHeld } = useKeepAliveState();

  const getId = () => toValue(id);
  const getName = () => toValue(name);
  const isEnabled = () => toValue(enabled);

  function getRegistration(): FieldControlRegistration | undefined {
    return isHeld.value || !isEnabled()
      ? undefined
      : {
          controlRef,
          getValue: getFormValueOverride,
          id: getId(),
          name: getName(),
          value: value(),
        };
  }

  // A lazy control can supply a field name that adds an error element. Wait until its HTML has hydrated.
  onMounted(() => {
    watch([getId, getName, value, isEnabled], () => registerFieldControl(source, getRegistration), {
      immediate: true,
    });
  });

  onScopeDispose(() => registerFieldControl(source, undefined));
}
