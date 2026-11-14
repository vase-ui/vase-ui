<script setup lang="ts">
import { mergeProps } from '@vase-ui/vue/merge-props';
import { Toggle } from '@vase-ui/vue/toggle';
import { Toolbar } from '@vase-ui/vue/toolbar';

function handleToolbarClick() {}

function handleToggleClick() {}
</script>

<template>
  <Toolbar.Root>
    <Toolbar.Button
      class="toolbar-button"
      :style="{ color: 'red', padding: '4px' }"
      @click="handleToolbarClick"
    >
      <template #render="{ props }">
        <Toggle
          v-bind="
            mergeProps(props, {
              class: 'toggle',
              style: { color: 'blue' },
              onClick: handleToggleClick,
            })
          "
        >
          Bold
        </Toggle>
      </template>
    </Toolbar.Button>
  </Toolbar.Root>
</template>
