<script setup lang="ts">
import { Form } from '../../src/form';

const emit = defineEmits<{ save: [event: SubmitEvent] }>();
</script>

<template>
  <Form @submit.prevent.once="(event) => emit('save', event)">
    <button type="submit">Submit</button>
  </Form>
</template>
