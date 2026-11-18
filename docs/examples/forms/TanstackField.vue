<script setup lang="ts">
import { useForm } from '@tanstack/vue-form';
import { Field } from '@vase-ui/vue/field';

const form = useForm({ defaultValues: { username: '' } });
</script>

<template>
  <form>
    <form.Field v-slot="{ field }" name="username">
      <Field.Root
        :name="field.name"
        :invalid="!field.state.meta.isValid"
        :dirty="field.state.meta.isDirty"
        :touched="field.state.meta.isTouched"
      >
        <Field.Label>Username</Field.Label>
        <Field.Control
          :model-value="field.state.value"
          placeholder="e.g. bob276"
          @value-change="field.handleChange"
          @blur="field.handleBlur"
        />
        <Field.Error :match="!field.state.meta.isValid">
          {{ field.state.meta.errors.join(',') }}
        </Field.Error>
      </Field.Root>
    </form.Field>
  </form>
</template>
