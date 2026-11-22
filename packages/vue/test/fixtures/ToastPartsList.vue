<script setup lang="ts">
import type { PropType } from 'vue';
import { Toast } from '../../src/toast';

type Props = Record<string, unknown>;

// Each toast has a root with its `id` in `data-id`, a content, a title, a description, an action
// and a close button, in a `<TransitionGroup>` with the name `toast`. `titleText`,
// `descriptionText` and `actionText` give the default slots. `teleportedInput` gives the
// description an input in a `<Teleport>` to the body. `secondTitle` adds a second title after the
// first. `withoutViewport` unmounts the viewport, and the provider stays. `withoutRoots` unmounts
// the roots, and the viewport stays. `withoutLabels` unmounts the titles and the description.
// `copies` gives each root a copy of its toast object.
defineProps({
  withoutViewport: Boolean,
  withoutRoots: Boolean,
  withoutLabels: Boolean,
  copies: Boolean,
  viewport: Object as PropType<Props>,
  group: { type: Object as PropType<Props>, default: () => ({}) },
  root: Object as PropType<Props>,
  title: Object as PropType<Props>,
  titleText: String,
  description: Object as PropType<Props>,
  descriptionText: String,
  teleportedInput: Boolean,
  secondTitle: Boolean,
  action: Object as PropType<Props>,
  actionText: String,
  close: Object as PropType<Props>,
});
const manager = Toast.useToastManager<{ note?: string }>();
defineExpose({ manager });
</script>

<template>
  <Toast.Viewport
    v-if="!withoutViewport"
    data-testid="viewport"
    aria-label="Notifications"
    v-bind="viewport"
  >
    <TransitionGroup name="toast" v-bind="group">
      <Toast.Root
        v-for="toast in withoutRoots ? [] : manager.toasts.value"
        :key="toast.id"
        :toast="copies ? { ...toast } : toast"
        :data-id="toast.id"
        v-bind="root"
      >
        <Toast.Content data-testid="content">
          <template v-if="!withoutLabels">
            <Toast.Title v-bind="title">
              <template v-if="titleText" #default>{{ titleText }}</template>
            </Toast.Title>
            <Toast.Title v-if="secondTitle">Second</Toast.Title>
            <Toast.Description v-bind="description">
              <template v-if="descriptionText" #default>{{ descriptionText }}</template>
              <template v-else-if="teleportedInput" #default>
                <Teleport to="body"><input id="moved" aria-label="Moved" /></Teleport>
              </template>
            </Toast.Description>
          </template>
          <Toast.Action v-bind="action">
            <template v-if="actionText" #default>{{ actionText }}</template>
          </Toast.Action>
          <Toast.Close v-bind="close">Close</Toast.Close>
        </Toast.Content>
      </Toast.Root>
    </TransitionGroup>
  </Toast.Viewport>
</template>
