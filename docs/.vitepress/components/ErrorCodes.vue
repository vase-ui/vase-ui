<script setup lang="ts">
import { errorMessages } from '../../../packages/vue/src/common/createError.ts';
import TextWithCode from './TextWithCode.vue';
</script>

<template>
  <table>
    <thead>
      <tr>
        <th scope="col">Code</th>
        <th scope="col">Text</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(text, code) in errorMessages" :id="code" :key="code">
        <td>{{ code }}</td>
        <td><TextWithCode :text="text" /></td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
tr:target {
  background-color: var(--vase-color-line-highlight);
}
</style>
