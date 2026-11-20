<script setup lang="ts">
import { Collapsible } from '@vase-ui/vue/collapsible';
</script>

<template>
  <Collapsible.Root as="section">
    <Collapsible.Trigger>Recovery keys</Collapsible.Trigger>
    <Collapsible.Panel>
      <template #element="{ props, elementRef, state }">
        <article v-bind="props" :ref="elementRef" :class="{ Disabled: state.disabled }">
          alien-bean-pasta
        </article>
      </template>
    </Collapsible.Panel>
  </Collapsible.Root>
</template>
