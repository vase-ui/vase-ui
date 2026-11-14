<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Form } from '@vase-ui/vue/form';

const form = useTemplateRef('form');

async function onSubmit(event: SubmitEvent) {
  // Prevent the browser's default full-page refresh
  event.preventDefault();
  const formData = new FormData(form.value?.element ?? undefined);
  await fetch('https://api.example.com', {
    method: 'POST',
    body: formData,
  });
}
</script>

<template>
  <Form ref="form" @submit="onSubmit" />
</template>
