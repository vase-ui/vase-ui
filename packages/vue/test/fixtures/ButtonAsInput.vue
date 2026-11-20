<script setup lang="ts">
import { Button } from '../../src/button';

defineProps({ disabled: Boolean });
</script>

<template>
  <form class="Form">
    <Button as="input" type="submit" value="Send" :disabled="disabled" />
  </form>
</template>
