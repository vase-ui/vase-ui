<script setup lang="ts">
import type { PropType } from 'vue';
import { Toast } from '../../src/toast';
import type { LabelSlot } from './ToastLabelSlots.vue';
import TextHeading from './TextHeading.vue';

defineProps({
  title: { type: String as PropType<LabelSlot>, required: true },
  description: { type: String as PropType<LabelSlot>, required: true },
  heading: { type: Object as PropType<{ text: string }>, required: true },
});
const manager = Toast.useToastManager();
defineExpose({ manager });
</script>

<template>
  <Toast.Viewport aria-label="Notifications">
    <Toast.Root
      v-for="toast in manager.toasts.value"
      :key="toast.id"
      :toast="toast"
      :data-id="toast.id"
    >
      <Toast.Title>
        <template #element="{ props: titleProps, elementRef }">
          <TextHeading
            v-if="title === 'component'"
            v-bind="titleProps"
            :ref="elementRef"
            :content="heading"
          />
          <h3 v-else-if="title !== 'none'" v-bind="titleProps" :ref="elementRef">
            {{ title === 'text' ? 'Own title' : toast.title }}
          </h3>
        </template>
      </Toast.Title>
      <Toast.Description>
        <template #element="{ props: descriptionProps, elementRef }">
          <p v-if="description !== 'none'" v-bind="descriptionProps" :ref="elementRef">
            {{ description === 'text' ? 'Own description' : toast.description }}
          </p>
        </template>
      </Toast.Description>
      <Toast.Action>
        <template #element="{ props: buttonProps, elementRef }">
          <button v-bind="buttonProps" :ref="elementRef">Undo</button>
        </template>
      </Toast.Action>
    </Toast.Root>
  </Toast.Viewport>
</template>
