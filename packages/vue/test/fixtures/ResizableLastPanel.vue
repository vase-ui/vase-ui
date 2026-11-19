<script setup lang="ts">
import { Resizable } from '../../src/resizable';

// The attributes go to the panel.
defineOptions({ inheritAttrs: false });
</script>

<template>
  <Resizable.Handle data-key="h2" aria-label="Resize b" />
  <Resizable.Panel id="c" v-bind="$attrs" />
</template>
