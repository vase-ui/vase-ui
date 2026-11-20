<script setup lang="ts">
import type { PropType } from 'vue';
import { Toast } from '../../src/toast';

type Props = Record<string, unknown>;

// Each toast has a root with its `id` in `data-id`, a content, a title, a description, an action
// and a close button, in a `<TransitionGroup>` with the name `toast`. `titleText` and
// `descriptionText` give the default slots.
defineProps({
  viewport: Object as PropType<Props>,
  group: { type: Object as PropType<Props>, default: () => ({}) },
  root: Object as PropType<Props>,
  title: Object as PropType<Props>,
  titleText: String,
  description: Object as PropType<Props>,
  descriptionText: String,
  action: Object as PropType<Props>,
  close: Object as PropType<Props>,
});
const manager = Toast.useToastManager<{ note?: string }>();
defineExpose({ manager });
</script>

<template>
  <Toast.Viewport data-testid="viewport" aria-label="Notifications" v-bind="viewport">
    <TransitionGroup name="toast" v-bind="group">
      <Toast.Root
        v-for="toast in manager.toasts.value"
        :key="toast.id"
        :toast="toast"
        :data-id="toast.id"
        v-bind="root"
      >
        <Toast.Content data-testid="content">
          <Toast.Title v-bind="title">
            <template v-if="titleText" #default>{{ titleText }}</template>
          </Toast.Title>
          <Toast.Description v-bind="description">
            <template v-if="descriptionText" #default>{{ descriptionText }}</template>
          </Toast.Description>
          <Toast.Action v-bind="action" />
          <Toast.Close v-bind="close">Close</Toast.Close>
        </Toast.Content>
      </Toast.Root>
    </TransitionGroup>
  </Toast.Viewport>
</template>
