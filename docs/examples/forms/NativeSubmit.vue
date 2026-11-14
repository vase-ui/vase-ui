<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Form } from '@vase-ui/vue/form';

const form = useTemplateRef('form');

async function onSubmit(event: SubmitEvent) {
  // Prevent the browser's default full-page refresh
  event.preventDefault();
  // Create a FormData object
  const formData = new FormData(form.value?.element ?? undefined);
  // Send the FormData instance in a fetch request
  await fetch('https://api.example.com', {
    method: 'POST',
    body: formData,
  });
}
</script>

<template>
  <Form ref="form" @submit="onSubmit" />
</template>
