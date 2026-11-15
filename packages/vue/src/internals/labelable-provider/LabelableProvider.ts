import { computed, provide, shallowRef, watch } from 'vue';
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

  const controlIdState = shallowRef<string | null>(defaultControlId.value);
  const { ids: controlIds, registerId: registerControlId } = createIdRegistry<string | null>();
  const { labelId, registerLabelId } = createLabelIdRegistry();
  const { ids: messageIds, registerId: registerMessageId } = createIdRegistry();

  // The selection runs one time for each flush, against all ids, as the state updater of Base UI
  // does. `KeepAlive` activates the controls of a branch from the last to the first. A selection
  // after each activation would select the last control.
  watch(controlIds, (ids) => {
    const [firstId] = ids;
    // With no id, the selected id stays. `KeepAlive` can deactivate each control, and the control
    // that comes back finds its id selected. A control with no id resets the id through
    // `resetControlId`.
    if (firstId === undefined) {
      return;
    }
    // A selected id that a control still registers stays, so other controls do not change it.
    if (!ids.includes(controlIdState.value)) {
      controlIdState.value = firstId;
    }
  });

  function resetControlId() {
    if (controlIds.value.length === 0) {
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
    messageIds,
    registerMessageId,
    getDescriptionProps,
  };

  provide(LabelableContext, context);

  return context;
}
