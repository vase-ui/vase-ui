<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
</script>

<template>
  <div id="protocols-label">Allowed network protocols</div>
  <CheckboxGroup aria-labelledby="protocols-label">
    <label>
      <Checkbox.Root value="http" />
      HTTP
    </label>
    <label>
      <Checkbox.Root value="https" />
      HTTPS
    </label>
  </CheckboxGroup>
</template>
