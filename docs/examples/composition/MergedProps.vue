<script setup lang="ts">
import { mergeProps } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import { Toolbar } from '@vase-ui/vue/toolbar';

function handleToolbarClick() {}

function handleMenuClick() {}
</script>

<template>
  <Toolbar.Root>
    <Menu.Root>
      <Toolbar.Button
        class="toolbar-button"
        :style="{ color: 'red', padding: '4px' }"
        @click="handleToolbarClick"
      >
        <template #element="{ props, elementRef }">
          <Menu.Trigger
            v-bind="
              mergeProps(
                { class: 'menu-trigger', style: { color: 'blue' }, onClick: handleMenuClick },
                props,
              )
            "
            :ref="elementRef"
          >
            Open menu
          </Menu.Trigger>
        </template>
      </Toolbar.Button>
    </Menu.Root>
  </Toolbar.Root>
</template>
