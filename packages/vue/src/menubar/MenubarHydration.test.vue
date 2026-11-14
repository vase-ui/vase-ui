<script setup lang="ts">
import { Menubar } from '@vase-ui/vue/menubar';
import type { Orientation } from '../internals/types';
import MenubarMockMenu from './MenubarMockMenu.test.vue';

withDefaults(
  defineProps<{
    id?: string;
    disabled?: boolean;
    orientation?: Orientation;
    modal?: boolean;
  }>(),
  { disabled: false, orientation: 'horizontal', modal: true },
);
</script>

<template>
  <Menubar :id="id" :disabled="disabled" :orientation="orientation" :modal="modal">
    <MenubarMockMenu data-testid="a">A</MenubarMockMenu>
    <MenubarMockMenu data-testid="b">B</MenubarMockMenu>
    <MenubarMockMenu data-testid="c">C</MenubarMockMenu>
  </Menubar>
</template>
