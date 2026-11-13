<script setup lang="ts">
import { provideLabelableContext } from '../../src/internals/labelable-provider';

provideLabelableContext();
</script>

<template>
  <div><slot /></div>
</template>
