<script setup lang="ts">
import type { PropType } from 'vue';
import { Form } from '../../src/form';

defineProps({ submits: { type: Array as PropType<SubmitEvent[]>, required: true } });
</script>

<template>
  <Form @submit.prevent.once="(event) => submits.push(event)">
    <button type="submit">Submit</button>
  </Form>
</template>
