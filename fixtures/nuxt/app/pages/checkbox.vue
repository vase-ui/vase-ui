<script setup lang="ts">
import { ref } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';

const news = ref(true);
</script>

<template>
  <main>
    <form data-testid="form">
      <label data-testid="label">
        <Checkbox data-testid="terms" name="terms" unchecked-value="no" />
        Terms
      </label>
      <Checkbox v-model="news" data-testid="news" name="news" aria-label="News" />
      <Checkbox indeterminate data-testid="some" aria-label="Some" />
      <output data-testid="news-value">{{ news }}</output>
    </form>
  </main>
</template>
