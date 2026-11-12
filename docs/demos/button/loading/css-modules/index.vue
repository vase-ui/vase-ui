<script setup lang="ts">
import { ref, useId } from 'vue';
import { Button } from '@vase-ui/vue/button';
import styles from './index.module.css';

const loading = ref(false);
const labelId = useId();

function submit() {
  loading.value = true;
  setTimeout(() => {
    loading.value = false;
  }, 4000);
}
</script>

<template>
  <Button
    :class="styles.Button"
    :disabled="loading"
    focusable-when-disabled
    :aria-labelledby="labelId"
    @click="submit"
  >
    <span :id="labelId">{{ loading ? 'Submitting' : 'Submit' }}</span>
  </Button>
</template>
