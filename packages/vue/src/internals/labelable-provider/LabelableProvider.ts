import { computed, provide, shallowRef } from 'vue';
import { useVaseUiId } from '../useBaseUiId';
import { LabelableContext, useLabelableContext } from './LabelableContext';
import type { MessageIdsSetter } from './LabelableContext';

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
  const registeredLabelId = shallowRef<string | undefined>();
  const messageIdsState = shallowRef<string[]>([]);
  const controlRegistrations = new Map<symbol, string | null>();
  const labelRegistrations = new Map<symbol, string>();

  function registerControlId(source: symbol, nextId: string | null | undefined) {
    if (nextId === undefined) {
      controlRegistrations.delete(source);
    } else {
      controlRegistrations.set(source, nextId);
    }

    const ids = Array.from(controlRegistrations.values());
    // With no registration, the id stays between the unmount of a control and the mount of the
    // next. A control that comes back with the same id then changes nothing, and a control with no
    // id resets the id through `resetControlId`.
    if (ids.length === 0) {
      return;
    }
    // A selected id that a control still registers stays, so other controls do not change it.
    if (!ids.includes(controlIdState.value)) {
      controlIdState.value = ids[0];
    }
  }

  function resetControlId() {
    if (controlRegistrations.size === 0) {
      controlIdState.value = defaultControlId.value;
    }
  }

  // A label registers by source, as a control does. Two labels in one provider can have the same id,
  // and a label can mount before the label that it replaces unmounts. A removal by id value would
  // then remove the id of the new label.
  function registerLabelId(source: symbol, nextId: string | undefined) {
    if (nextId === undefined) {
      labelRegistrations.delete(source);
    } else {
      labelRegistrations.set(source, nextId);
    }

    registeredLabelId.value = Array.from(labelRegistrations.values()).at(-1);
  }

  const setMessageIds: MessageIdsSetter = (next) => {
    messageIdsState.value = typeof next === 'function' ? next(messageIdsState.value) : next;
  };

  function getDescriptionProps(externalProps: Record<string, any>) {
    const ids: string[] = externalProps['aria-describedby']
      ? externalProps['aria-describedby'].split(' ')
      : [];
    ids.push(...parent.messageIds.value, ...messageIdsState.value);

    return {
      ...externalProps,
      'aria-describedby': Array.from(new Set(ids)).join(' ') || undefined,
    };
  }

  const context: LabelableContext = {
    controlId: computed(() => controlIdState.value),
    registerControlId,
    resetControlId,
    labelId: computed(() => registeredLabelId.value),
    registerLabelId,
    defaultLabelId,
    messageIds: computed(() => messageIdsState.value),
    setMessageIds,
    getDescriptionProps,
  };

  provide(LabelableContext, context);

  return context;
}
