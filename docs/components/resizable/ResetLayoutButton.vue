<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';

const root = Resizable.useParentRoot();
</script>

<template>
  <button type="button" :disabled="root === null" @click="root?.reset()">Reset the layout</button>
</template>
