<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Select } from '@vase-ui/vue/select';
</script>

<template>
  <Field.Root name="apple">
    <div style="position: relative">
      <Select.Root>
        <Select.Label>Apple</Select.Label>
        <Select.Trigger />
      </Select.Root>
    </div>
  </Field.Root>
</template>
