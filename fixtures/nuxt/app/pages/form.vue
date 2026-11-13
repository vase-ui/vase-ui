<script setup lang="ts">
import { ref } from 'vue';
import { Form } from '@vase-ui/vue/form';

const email = ref('');

function readEmail(event: SubmitEvent) {
  email.value = String(new FormData(event.currentTarget as HTMLFormElement).get('email'));
}
</script>

<template>
  <main>
    <Form data-testid="form" @submit.prevent="readEmail">
      <input name="email" value="a@b.c" data-testid="email" />
      <button type="submit" data-testid="submit">Send</button>
    </Form>
    <output data-testid="output">{{ email }}</output>
  </main>
</template>
