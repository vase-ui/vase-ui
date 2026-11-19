<!-- @strictTemplates true -->
<script setup lang="ts">
import { Separator } from '@vase-ui/vue/separator';

function log(event: MouseEvent) {
  return event.detail;
}
</script>

<!-- A separator takes the native attributes of its element in a template. -->
<template>
  <Separator aria-hidden="true" aria-label="Sections" lang="fr" title="Sections" @click="log" />
  <!-- @vue-expect-error `aria-label` is a string -->
  <Separator :aria-label="5" />
</template>
