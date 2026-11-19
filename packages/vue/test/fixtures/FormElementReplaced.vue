<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Field } from '../../src/field';
import { Form } from '../../src/form';
import { Input } from '../../src/input';

defineProps({ form: Object as PropType<Record<string, unknown>> });
const formPart = useTemplateRef('formPart');
defineExpose({ form: formPart });
</script>

<template>
  <Form ref="formPart" v-bind="form">
    <template #element="{ props, elementRef }">
      <form v-bind="props" :ref="elementRef" class="Styled">
        <Field.Root>
          <Input required />
          <Field.Error />
        </Field.Root>
        <button type="submit">Submit</button>
      </form>
    </template>
  </Form>
</template>
