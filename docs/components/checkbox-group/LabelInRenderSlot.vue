<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
</script>

<template>
  <div id="protocols-label">Allowed network protocols</div>
  <CheckboxGroup aria-labelledby="protocols-label">
    <Checkbox.Root value="http" native-button>
      <template #render="{ props }">
        <label>
          <button v-bind="props" />
          HTTP
        </label>
      </template>
    </Checkbox.Root>
  </CheckboxGroup>
</template>
