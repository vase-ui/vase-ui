<script setup lang="ts">
import { shallowRef } from 'vue';
import { Input } from '@vase-ui/vue/input';

const value = shallowRef('foo');
</script>

<template>
  <Input v-model="value" data-testid="input" />
  <output data-testid="value">{{ value }}</output>
</template>
