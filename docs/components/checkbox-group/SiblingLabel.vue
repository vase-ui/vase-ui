<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
</script>

<template>
  <div id="protocols-label">Allowed network protocols</div>
  <CheckboxGroup aria-labelledby="protocols-label">
    <div>
      <label for="protocol-http">HTTP</label>
      <Checkbox.Root id="protocol-http" value="http" native-button as="button">
        <Checkbox.Indicator />
      </Checkbox.Root>
    </div>
  </CheckboxGroup>
</template>
