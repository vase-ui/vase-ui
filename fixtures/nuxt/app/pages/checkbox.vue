<script setup lang="ts">
import { ref } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';

const news = ref(true);
</script>

<template>
  <main>
    <form data-testid="form">
      <label data-testid="label">
        <Checkbox.Root data-testid="terms" name="terms" unchecked-value="no">
          <Checkbox.Indicator data-testid="terms-indicator">Tick</Checkbox.Indicator>
        </Checkbox.Root>
        Terms
      </label>
      <Checkbox.Root v-model:checked="news" data-testid="news" name="news" aria-label="News">
        <Checkbox.Indicator data-testid="news-indicator">Tick</Checkbox.Indicator>
      </Checkbox.Root>
      <Checkbox.Root indeterminate data-testid="some" aria-label="Some">
        <Checkbox.Indicator data-testid="some-indicator">Tick</Checkbox.Indicator>
      </Checkbox.Root>
      <Checkbox.Root data-testid="kept" aria-label="Kept">
        <Checkbox.Indicator data-testid="kept-indicator" keep-mounted>Tick</Checkbox.Indicator>
      </Checkbox.Root>
      <output data-testid="news-value">{{ news }}</output>
    </form>
  </main>
</template>
