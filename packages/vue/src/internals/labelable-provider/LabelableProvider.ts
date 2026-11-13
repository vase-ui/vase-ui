import { computed, provide, shallowReactive, shallowRef, watch } from 'vue';
import { useVaseUiId } from '../useBaseUiId';
import { LabelableContext, useLabelableContext } from './LabelableContext';
import { createIdRegistry } from './createIdRegistry';
import { createLabelIdRegistry } from './createLabelIdRegistry';

/**
 * Makes the labelable context of a field and provides it to the parts below.
 * `Field.Root` and `Field.Item` call it in `setup`.
 * A component cannot `inject` what it provides, so the root uses the context that this returns.
 */
export function provideLabelableContext(): LabelableContext {
  // The outer provider. `inject` reads the provides of the parent component, so it does not
  // return the context that this function makes.
  const parent = useLabelableContext();

  const defaultControlId = useVaseUiId();
  const defaultLabelId = useVaseUiId();

  const controlIdState = shallowRef<string | null>(defaultControlId.value);
  const controlRegistrations = shallowReactive(new Map<symbol, string | null>());
  const { labelId, registerLabelId } = createLabelIdRegistry();
  const { ids: messageIds, registerId: registerMessageId } = createIdRegistry();

  function registerControlId(source: symbol, nextId: string | null | undefined) {
    if (nextId === undefined) {
      controlRegistrations.delete(source);
    } else {
      controlRegistrations.set(source, nextId);
    }
  }

  // The selection runs one time for each flush, against all registrations, as the state updater of
  // Base UI does. A selection at each registration would depend on the order of the registrations,
  // and `KeepAlive` runs the `onActivated` hooks of one branch from its last part to its first part.
  watch(
    () => Array.from(controlRegistrations.values()),
    (ids) => {
      // With no registration, the id stays. `KeepAlive` removes the registration of a deactivated
      // control, and the id of that control stays selected until `KeepAlive` activates it again.
      // A control with no id resets the id through `resetControlId`.
      if (ids.length === 0) {
        return;
      }
      // A selected id that a control still registers stays, so other controls do not change it.
      if (!ids.includes(controlIdState.value)) {
        controlIdState.value = ids[0];
      }
    },
  );

  function resetControlId() {
    if (controlRegistrations.size === 0) {
      controlIdState.value = defaultControlId.value;
    }
  }

  function getDescriptionProps(externalProps: Record<string, any>) {
    const ids: string[] = externalProps['aria-describedby']
      ? externalProps['aria-describedby'].split(' ')
      : [];
    ids.push(...parent.messageIds.value, ...messageIds.value);

    return {
      ...externalProps,
      'aria-describedby': Array.from(new Set(ids)).join(' ') || undefined,
    };
  }

  const context: LabelableContext = {
    controlId: computed(() => controlIdState.value),
    registerControlId,
    resetControlId,
    labelId,
    registerLabelId,
    defaultLabelId,
    messageIds,
    registerMessageId,
    getDescriptionProps,
  };

  provide(LabelableContext, context);

  return context;
}
