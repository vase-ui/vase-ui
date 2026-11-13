<script lang="ts">
import type { ButtonHTMLAttributes } from 'vue';
import type {
  ComponentRenderFn,
  HTMLProps,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../src/internals/types';
import type { PopupFixtureHandle } from './PopupFixture';

export interface PopupTriggerPartState {
  /** Whether this trigger opened the popup. */
  open: boolean;
}

export interface PopupTriggerPartProps
  extends
    VaseUIComponentProps<PopupTriggerPartState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<ButtonHTMLAttributes, 'id'>> {
  /** The handle of a trigger that is not in the root. */
  handle?: PopupFixtureHandle<any> | undefined;
  /** The data that the trigger gives to the popup while it is the active trigger. */
  payload?: unknown;
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { createChangeEventDetails } from '../../src/internals/createBaseUIEventDetails';
import { REASONS } from '../../src/internals/reasons';
import { useVaseUiId } from '../../src/internals/useBaseUiId';
import { useRenderElement } from '../../src/internals/useRenderElement';
import { triggerOpenStateMapping } from '../../src/utils/popups/popupStateMapping';
import { useTriggerDataForwarding } from '../../src/utils/popups/popupStoreUtils';
import { usePopupHandleStore } from '../../src/utils/popups/usePopupHandleStore';
import { PopupFixtureContext } from './PopupFixture';
import type { PopupFixtureHandleStore } from './PopupFixture';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopupTriggerPartProps>(), { as: 'button' });

defineSlots<{
  default(props: { state: PopupTriggerPartState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopupTriggerPartState>;
}>();

const rootStore = inject(PopupFixtureContext, undefined);
const handleStore = usePopupHandleStore(() => props.handle);
const store = computed<PopupFixtureHandleStore<any>>(() => {
  const current = handleStore.value ?? rootStore;
  if (current === undefined) {
    throw new Error('Vase UI: <PopupTriggerPart> needs a root or a handle.');
  }
  return current;
});

const triggerId = useVaseUiId(() => props.id);
const isOpenedByThisTrigger = computed(() =>
  store.value.select('isOpenedByTrigger', triggerId.value),
);
const popupId = computed(() => store.value.select('triggerPopupId', triggerId.value));

const { registerTrigger } = useTriggerDataForwarding(triggerId, store, () => ({
  payload: props.payload,
}));

const state = computed<PopupTriggerPartState>(() => ({ open: isOpenedByThisTrigger.value }));

const { element, elementProps } = useRenderElement('button', props, {
  state,
  ref: [registerTrigger],
  stateAttributesMapping: triggerOpenStateMapping,
  props: (attrs) => [
    {
      id: triggerId.value,
      'aria-expanded': state.value.open,
      'aria-controls': popupId.value,
      onClick(event: MouseEvent) {
        store.value.setOpen(
          !state.value.open,
          createChangeEventDetails(REASONS.triggerPress, event, event.currentTarget as Element),
        );
      },
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
