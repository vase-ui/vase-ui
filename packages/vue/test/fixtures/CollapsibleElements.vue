<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Collapsible } from '../../src/collapsible';

// Each part renders its element in the `element` slot, and writes its state in `data-state`. The
// trigger is a `<span>`, or the tag of `triggerTag`.
defineProps({ root: Object, trigger: Object, triggerTag: { type: String, default: 'span' } });
const rootPart = useTemplateRef('rootPart');
const triggerPart = useTemplateRef('triggerPart');
const panelPart = useTemplateRef('panelPart');
defineExpose({ root: rootPart, trigger: triggerPart, panel: panelPart });
</script>

<template>
  <input aria-label="Before" />
  <Collapsible.Root ref="rootPart" v-bind="root">
    <template #element="{ props: rootProps, elementRef: rootRef, state: rootState }">
      <section v-bind="rootProps" :ref="rootRef" :data-state="JSON.stringify(rootState)">
        <Collapsible.Trigger ref="triggerPart" v-bind="trigger">
          <template #element="{ props: triggerProps, elementRef: triggerRef, state }">
            <component
              :is="triggerTag"
              v-bind="triggerProps"
              :ref="triggerRef"
              :data-state="JSON.stringify(state)"
            >
              Trigger
            </component>
          </template>
        </Collapsible.Trigger>
        <Collapsible.Panel ref="panelPart">
          <template #element="{ props: panelProps, elementRef: panelRef, state }">
            <article v-bind="panelProps" :ref="panelRef" :data-state="JSON.stringify(state)">
              Content
            </article>
          </template>
        </Collapsible.Panel>
      </section>
    </template>
  </Collapsible.Root>
  <input aria-label="After" />
</template>
