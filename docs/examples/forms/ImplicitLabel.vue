<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <Field.Root>
    <Field.Label>
      <Switch.Root />
      Developer mode
    </Field.Label>
    <Field.Description>Enables extra tools for web developers</Field.Description>
  </Field.Root>
</template>
