<script setup lang="ts">
import * as Drawer from '../src/drawer/index.parts';
import PlainPart from './fixtures/PlainPart.vue';

// A compiled template, as in an app. `stateClass` runs in each render of its part. The inner part
// stands for the popup. A `v-if` on the viewport, and not on a slot template, picks the form.
defineProps<{
  hasRenderSlot: boolean;
  active: boolean;
  onPartRender: () => undefined;
  onInnerRender: () => undefined;
}>();
</script>

<template>
  <Drawer.Root open>
    <Drawer.Portal>
      <Drawer.Viewport v-if="hasRenderSlot" :data-active="active" :state-class="onPartRender">
        <template #render="{ props }">
          <section v-bind="props">
            <PlainPart data-testid="inner" :state-class="onInnerRender">Content</PlainPart>
          </section>
        </template>
      </Drawer.Viewport>
      <Drawer.Viewport v-else :data-active="active" :state-class="onPartRender">
        <PlainPart data-testid="inner" :state-class="onInnerRender">Content</PlainPart>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>
