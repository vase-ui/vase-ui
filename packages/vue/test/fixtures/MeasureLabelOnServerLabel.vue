<script setup lang="ts">
import { inject, useId, type ShallowRef } from 'vue';

const id = useId();
inject<ShallowRef<string | undefined>>('label id')!.value = id;
</script>

<template>
  <span :id="id"><slot /></span>
</template>
