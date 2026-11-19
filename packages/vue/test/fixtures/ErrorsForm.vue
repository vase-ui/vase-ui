<script setup lang="ts">
import { shallowRef } from 'vue';
import { Form, type FormErrors } from '../../src/form';

// A form whose parent writes each change of `errors`, as `v-model:errors` does.
const props = defineProps<{ errors?: FormErrors }>();
const errors = shallowRef(props.errors);
</script>

<template>
  <Form v-model:errors="errors"><slot /></Form>
</template>
