<script setup lang="ts">
import { Collapsible } from '@vase-ui/vue/collapsible';
</script>

<template>
  <Collapsible.Root>
    <Collapsible.Trigger>Shipping details</Collapsible.Trigger>
    <Collapsible.Panel hidden-until-found>
      Standard shipping takes 3–5 business days.
    </Collapsible.Panel>
  </Collapsible.Root>
</template>
