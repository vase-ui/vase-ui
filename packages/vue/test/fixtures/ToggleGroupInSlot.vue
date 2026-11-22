<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Toggle } from '../../src/toggle';
import { ToggleGroup } from '../../src/toggle-group';

// A group that renders a `<section>` in its `element` slot. The toggle `b` renders its own
// `<button>` in its `element` slot.
const group = useTemplateRef('group');
defineExpose({ group });
</script>

<template>
  <input id="before" aria-label="Before" />
  <ToggleGroup ref="group" aria-label="Alignment" class="Group" orientation="vertical">
    <template #element="{ props, elementRef, state }">
      <section v-bind="props" :ref="elementRef" :data-state="state.orientation">
        <Toggle id="a" value="a">A</Toggle>
        <Toggle id="b" value="b">
          <template #element="{ props: toggleProps, elementRef: toggleRef }">
            <button v-bind="toggleProps" :ref="toggleRef" class="Slotted">B</button>
          </template>
        </Toggle>
      </section>
    </template>
  </ToggleGroup>
  <input id="after" aria-label="After" />
</template>
