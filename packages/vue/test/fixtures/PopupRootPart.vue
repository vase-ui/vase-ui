<script setup lang="ts" generic="Payload">
import { provide } from 'vue';
import { usePopupRoot } from '../../src/utils/popups/popupRoot';
import type { PopupOpenChangeEventDetails } from '../../src/utils/popups/store';
import { PopupFixtureContext, PopupFixtureStore } from './PopupFixture';
import type { PopupFixtureHandle } from './PopupFixture';

const props = withDefaults(
  defineProps<{
    open?: boolean | undefined;
    defaultOpen?: boolean | undefined;
    triggerId?: string | null | undefined;
    defaultTriggerId?: string | null | undefined;
    handle?: PopupFixtureHandle<Payload> | undefined;
    disabled?: boolean | undefined;
    animateInitialOpen?: boolean | undefined;
  }>(),
  {
    open: undefined,
    defaultOpen: false,
    triggerId: undefined,
    defaultTriggerId: null,
    handle: undefined,
    disabled: false,
    animateInitialOpen: false,
  },
);

const emit = defineEmits<{
  openChange: [open: boolean, details: PopupOpenChangeEventDetails];
  'update:open': [open: boolean];
  openChangeComplete: [open: boolean];
}>();

defineSlots<{ default(props: { payload: Payload | undefined }): unknown }>();

const { store, open, mounted, payload, transitionStatus, actions } = usePopupRoot(
  props,
  (initialState, defaultPopupId) => new PopupFixtureStore<Payload>(initialState, defaultPopupId),
  {
    name: 'PopupRootPart',
    closeOnActiveTriggerUnmount: true,
    animateInitialOpen: props.animateInitialOpen,
    disabled: () => props.disabled,
    handle: () => props.handle,
    onOpenChange(open, details) {
      emit('openChange', open, details);
      if (!details.isCanceled) {
        emit('update:open', open);
      }
    },
    onOpenChangeComplete(open) {
      emit('openChangeComplete', open);
    },
  },
);

provide(PopupFixtureContext, store);

defineExpose({ ...actions, store, open, mounted, transitionStatus });
</script>

<template>
  <slot :payload="payload" />
</template>
