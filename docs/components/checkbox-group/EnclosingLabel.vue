<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
</script>

<template>
  <CheckboxGroup aria-label="Allowed network protocols">
    <label>
      <Checkbox value="http" />
      HTTP
    </label>
  </CheckboxGroup>
</template>
