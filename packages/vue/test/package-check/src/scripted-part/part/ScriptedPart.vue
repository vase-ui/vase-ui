<script setup lang="ts">
import PrehydrationScript from '../../../../../src/internals/PrehydrationScript.vue';
import { script } from './prehydrationScript.min';
</script>

<template>
  <span data-scripted-part />
  <PrehydrationScript :script="script" />
</template>
