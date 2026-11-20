<script setup lang="ts">
import PrehydrationScript from '../../../../../src/tabs/PrehydrationScript.vue';
import { script } from './prehydrationScript.min';
</script>

<template>
  <span data-scripted-part />
  <PrehydrationScript :script="script" />
</template>
