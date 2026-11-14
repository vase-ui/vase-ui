<script setup lang="ts">
import { Switch } from '@vase-ui/vue/switch';
</script>

<template>
  <Switch.Root>
    <Switch.Thumb>
      <template #render="{ props, state }">
        <span v-bind="props">
          <template v-if="state.checked">On</template>
          <template v-else>Off</template>
        </span>
      </template>
    </Switch.Thumb>
  </Switch.Root>
</template>
