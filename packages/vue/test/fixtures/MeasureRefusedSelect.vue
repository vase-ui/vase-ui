<script setup lang="ts">
import { shallowRef } from 'vue';

// A select whose options bind `selected` to a value that a change does not update, as a parent that
// keeps its value.
const value = shallowRef('a');
const changes = shallowRef(0);
defineExpose({ value, changes });
</script>

<template>
  <select aria-label="Letter" @change="changes++">
    <option
      v-for="letter in ['a', 'b', 'c']"
      :key="letter"
      :value="letter"
      :selected="letter === value"
    >
      {{ letter }}
    </option>
  </select>
</template>
