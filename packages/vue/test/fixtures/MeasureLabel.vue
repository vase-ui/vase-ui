<script setup lang="ts">
import { inject, type ShallowRef } from 'vue';

inject<ShallowRef<string | undefined>>('label id')!.value = 'label';
</script>

<template>
  <span id="label">Battery</span>
</template>
