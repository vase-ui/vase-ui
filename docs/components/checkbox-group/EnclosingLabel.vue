<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
</script>

<template>
  <CheckboxGroup>
    <label>
      <Checkbox.Root value="http" />
      HTTP
    </label>
  </CheckboxGroup>
</template>
