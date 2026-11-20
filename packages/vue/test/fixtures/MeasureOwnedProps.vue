<script setup lang="ts">
import MeasureOwnedPropWrapper from './MeasureOwnedPropWrapper.vue';
</script>

<template>
  <MeasureOwnedPropWrapper id="kebab" :min-days="2" multiple />
  <MeasureOwnedPropWrapper id="camel" :minDays="2" :multiple="true" />
</template>
