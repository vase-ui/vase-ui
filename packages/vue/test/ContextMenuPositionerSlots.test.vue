<script setup lang="ts">
import * as ContextMenu from '../src/context-menu/index.parts';
import PlainPart from './fixtures/PlainPart.vue';

// A compiled template, as in an app. `stateClass` runs in each render of its part. The inner part
// stands for the popup. A `v-if` on the positioner, and not on a slot template, picks the form.
defineProps<{
  hasRenderSlot: boolean;
  active: boolean;
  onPartRender: () => undefined;
  onInnerRender: () => undefined;
}>();
</script>

<template>
  <ContextMenu.Root open>
    <ContextMenu.Portal>
      <ContextMenu.Positioner
        v-if="hasRenderSlot"
        data-testid="positioner"
        :data-active="active"
        :state-class="onPartRender"
      >
        <template #render="{ props }">
          <section v-bind="props">
            <PlainPart data-testid="inner" :state-class="onInnerRender">Content</PlainPart>
          </section>
        </template>
      </ContextMenu.Positioner>
      <ContextMenu.Positioner
        v-else
        data-testid="positioner"
        :data-active="active"
        :state-class="onPartRender"
      >
        <PlainPart data-testid="inner" :state-class="onInnerRender">Content</PlainPart>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  </ContextMenu.Root>
</template>
