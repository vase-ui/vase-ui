<script setup lang="ts">
import Scenario from '#scenario';
import { count } from '../count.ts';
</script>

<template>
  <div v-for="instance in count" :key="instance" data-bench="instance"><Scenario /></div>
</template>
