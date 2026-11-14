<script setup lang="ts">
import { Field } from '@vase-ui/vue/field';
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <Field.Root name="notifications">
    <div style="position: relative">
      <Field.Label>
        <Switch.Root required />
        Notifications
      </Field.Label>
    </div>
  </Field.Root>
</template>
