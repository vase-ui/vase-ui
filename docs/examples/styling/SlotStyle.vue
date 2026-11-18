<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <Switch.Root>
    <Switch.Thumb>
      <template #render="{ props, state }">
        <span v-bind="props" :ref="props.ref" :style="{ color: state.checked ? 'red' : 'blue' }" />
      </template>
    </Switch.Thumb>
  </Switch.Root>
</template>
