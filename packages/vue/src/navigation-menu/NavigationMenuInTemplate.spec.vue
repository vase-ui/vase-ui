<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { ref } from 'vue';
import {
  NavigationMenu,
  type NavigationMenuContentState,
  type NavigationMenuRootChangeEventDetails,
  type NavigationMenuRootState,
  type NavigationMenuTriggerState,
} from '@vase-ui/vue/navigation-menu';

type Section = 'docs' | 'blog';

// A ref that the page empties with `null` when no item is open.
const section = ref<Section | null>(null);

function onSection(value: Section | null, details: NavigationMenuRootChangeEventDetails) {
  return (value?.length ?? 0) + details.reason.length;
}
</script>

<template>
  <!-- The root takes the type of its value from `v-model` and `default-value`. -->
  <NavigationMenu.Root v-model="section" @value-change="onSection" />
  <NavigationMenu.Root
    :default-value="'docs' as Section"
    @value-change="(value) => expectType<Section | null, typeof value>(value)"
  />
  <!-- @vue-expect-error The value of the root is a section. -->
  <NavigationMenu.Root v-model="section" @value-change="(value: number) => value" />

  <!-- The slots of the parts give their state. -->
  <NavigationMenu.Root v-slot="{ state }">
    <span @click="expectType<NavigationMenuRootState, typeof state>(state)" />
  </NavigationMenu.Root>
  <NavigationMenu.Trigger>
    <template #element="{ props, elementRef, state }">
      <button
        v-bind="props"
        :ref="elementRef"
        @click="expectType<NavigationMenuTriggerState, typeof state>(state)"
      />
    </template>
  </NavigationMenu.Trigger>

  <!-- A content takes the props of `<Transition>`. -->
  <NavigationMenu.Content
    v-slot="{ state }"
    keep-mounted
    :transition="{ name: 'slide', onAfterEnter: () => {} }"
  >
    <span @click="expectType<NavigationMenuContentState, typeof state>(state)" />
  </NavigationMenu.Content>
  <!-- @vue-expect-error `transition` takes the props of `<Transition>`. -->
  <NavigationMenu.Content :transition="'slide'" />
</template>
