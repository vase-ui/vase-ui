<script setup lang="ts">
import { useVaseUiId } from '../../src/internals/useBaseUiId';
import HiddenInputControl from './HiddenInputControl.vue';

const inputId = useVaseUiId();
</script>

<template>
  <label :for="inputId">Name</label>
  <HiddenInputControl :id="inputId" />
</template>
