<script setup lang="ts">
// The type check of this file fails when `@vue/language-core` changes the `//` of the URL into a
// comment. See https://github.com/vuejs/language-tools/pull/6241.
import { Avatar } from '@vase-ui/vue/avatar';
</script>

<template>
  <Avatar.Root>
    <Avatar.Image src="https://vuejs.org/images/logo.png" />
    <Avatar.Fallback>V</Avatar.Fallback>
  </Avatar.Root>
</template>
