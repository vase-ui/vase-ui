<script setup lang="ts">
import { Resizable } from '../../src/resizable';
import ElementOfDeveloper from './ElementOfDeveloper.vue';

// Each part renders an element of the developer in its `element` slot: a component that exposes
// its element for the root and the handle, and a `<section>` for the first panel.
defineProps<{ orientation?: 'horizontal' | 'vertical' }>();
</script>

<template>
  <div style="width: 400px; height: 100px">
    <Resizable.Root :orientation="orientation">
      <template #element="{ props, elementRef, state }">
        <ElementOfDeveloper
          tag="main"
          v-bind="props"
          :ref="elementRef"
          style="height: 100%"
          :data-state="JSON.stringify(state)"
        >
          <Resizable.Panel id="first" :default-size="30" disabled>
            <template #element="{ props: panelProps, elementRef: panelRef, state: panelState }">
              <section
                v-bind="panelProps"
                :ref="panelRef"
                :data-state="JSON.stringify(panelState)"
              />
            </template>
          </Resizable.Panel>
          <Resizable.Handle aria-label="Resize first">
            <template #element="{ props: handleProps, elementRef: handleRef, state: handleState }">
              <ElementOfDeveloper
                tag="span"
                v-bind="handleProps"
                :ref="handleRef"
                :data-state="JSON.stringify(handleState)"
              />
            </template>
          </Resizable.Handle>
          <Resizable.Panel id="second" v-slot="{ state: secondState }">
            <output class="panel-state">{{ JSON.stringify(secondState) }}</output>
          </Resizable.Panel>
        </ElementOfDeveloper>
      </template>
    </Resizable.Root>
  </div>
</template>
