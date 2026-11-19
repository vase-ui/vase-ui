<script setup lang="ts">
import type { PropType } from 'vue';
import { Form } from '../../src/form';

defineProps({
  submits: { type: Object as PropType<{ add(event: SubmitEvent): void }>, required: true },
});
</script>

<template>
  <Form @submit.prevent.once="(event) => submits.add(event)">
    <button type="submit">Submit</button>
  </Form>
</template>
