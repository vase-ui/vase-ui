<script setup lang="ts">
import { Resizable } from '../../src/resizable';
import ResizableWidthReader from './ResizableWidthReader.vue';

// A child of each panel reads the width of its panel in `onMounted`, and gives it to `log`.
defineProps<{ log: { read(key: string, width: number): void } }>();
</script>

<template>
  <div style="width: 400px; height: 100px">
    <Resizable.Root style="height: 100%">
      <Resizable.Panel id="a" :default-size="30"
        ><ResizableWidthReader @read="log.read('a', $event)"
      /></Resizable.Panel>
      <Resizable.Handle aria-label="Resize a" />
      <Resizable.Panel id="b"
        ><ResizableWidthReader @read="log.read('b', $event)"
      /></Resizable.Panel>
      <Resizable.Handle aria-label="Resize b" />
      <Resizable.Panel id="c" default-size="100px"
        ><ResizableWidthReader @read="log.read('c', $event)"
      /></Resizable.Panel>
    </Resizable.Root>
  </div>
</template>
