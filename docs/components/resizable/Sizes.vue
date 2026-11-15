<script setup lang="ts">
import { Resizable } from '@vase-ui/vue/resizable';
</script>

<template>
  <Resizable.Root>
    <Resizable.Panel :default-size="20" min-size="10%" max-size="40" />
    <Resizable.Handle aria-label="Resize the first panel" />
    <Resizable.Panel default-size="240px" min-size="12em" max-size="30rem" />
    <Resizable.Handle aria-label="Resize the second panel" />
    <Resizable.Panel min-size="20vw" max-size="80vh" />
  </Resizable.Root>
</template>
