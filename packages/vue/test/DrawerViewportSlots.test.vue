<script setup lang="ts">
import * as Drawer from '../src/drawer/index.parts';
import PlainPart from './fixtures/PlainPart.vue';

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
      <Drawer.Viewport
        v-if="hasRenderSlot"
        :data-active="active"
        @vue:mounted="onPartRender"
        @vue:updated="onPartRender"
      >
        <template #render="{ props }">
          <section v-bind="props">
            <PlainPart data-testid="inner" @vue:mounted="onInnerRender" @vue:updated="onInnerRender"
              >Content</PlainPart
            >
          </section>
        </template>
      </Drawer.Viewport>
      <Drawer.Viewport
        v-else
        :data-active="active"
        @vue:mounted="onPartRender"
        @vue:updated="onPartRender"
      >
        <PlainPart data-testid="inner" @vue:mounted="onInnerRender" @vue:updated="onInnerRender"
          >Content</PlainPart
        >
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>
