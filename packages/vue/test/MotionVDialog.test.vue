<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { motion } from 'motion-v';
import type { MotionProps, VariantType } from 'motion-v';
import * as Dialog from '../src/dialog/index.parts';

const props = defineProps<{
  open: boolean;
  /** How the popup gets the motion component: the `#render` slot or the `as` prop. */
  form: 'render' | 'as';
  closed: VariantType;
  opened: VariantType;
  /** The duration of each animation, in seconds. */
  duration: number;
  preventUnmountOnClose?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  openChangeComplete: [open: boolean];
  exitComplete: [];
}>();

const root = useTemplateRef('root');

function handleOpenChange(open: boolean, details: Dialog.Root.ChangeEventDetails) {
  if (!open && props.preventUnmountOnClose) {
    details.preventUnmountOnClose();
  }
  emit('update:open', open);
}

function handleAnimationComplete() {
  if (!props.open) {
    emit('exitComplete');
  }
}

defineExpose({ unmount: () => root.value?.unmount() });
</script>

<template>
  <Dialog.Root
    ref="root"
    :open="open"
    @open-change="handleOpenChange"
    @open-change-complete="emit('openChangeComplete', $event)"
  >
    <Dialog.Portal>
      <Dialog.Popup
        v-if="form === 'as'"
        data-testid="popup"
        :as="motion.div"
        :initial="false"
        :animate="open ? opened : closed"
        :transition="{ duration, ease: 'linear' }"
        @animation-complete="handleAnimationComplete"
      >
        <Dialog.Title>Title</Dialog.Title>
      </Dialog.Popup>
      <Dialog.Popup v-else data-testid="popup">
        <template #render="{ props: popupProps, state }">
          <motion.div
            v-bind="popupProps as MotionProps"
            :initial="false"
            :animate="state.open ? opened : closed"
            :transition="{ duration, ease: 'linear' }"
            @animation-complete="handleAnimationComplete"
          >
            <Dialog.Title>Title</Dialog.Title>
          </motion.div>
        </template>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
