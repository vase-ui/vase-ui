<script setup lang="ts">
// vue-tsc checks the types of the components that the Nuxt module adds. No page renders this
// component.
</script>

<template>
  <!-- @vue-expect-error `open` is a boolean. -->
  <Dialog.Root open="yes" />
  <!-- @vue-expect-error The name that Nuxt gives to `Dialog.Root` has the same types. -->
  <DialogRoot open="yes" />
</template>
