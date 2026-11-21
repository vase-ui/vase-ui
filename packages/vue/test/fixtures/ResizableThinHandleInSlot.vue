<script setup lang="ts">
import { Resizable } from '../../src/resizable';

// A handle with no width in the `element` slot. With `target`, the element of the slot ends with
// the span of `targetProps`.
defineProps({ target: Boolean });
</script>

<template>
  <div style="width: 400px; height: 100px">
    <Resizable.Root style="height: 100%">
      <Resizable.Panel id="a" data-key="a" />
      <Resizable.Handle aria-label="Resize a">
        <template #element="{ props, elementRef, targetProps }">
          <div v-bind="props" :ref="elementRef" data-key="h1" style="flex: none; width: 0px">
            <span v-if="target" v-bind="targetProps" />
          </div>
        </template>
      </Resizable.Handle>
      <Resizable.Panel id="b" data-key="b" />
    </Resizable.Root>
  </div>
</template>
