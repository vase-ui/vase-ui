<script setup lang="ts">
import ServerElementReader from './ServerElementReader.test.vue';

defineProps<{
  form: 'element' | 'fragment' | 'empty fragment' | 'no element';
  onRead?: ((testId: string | null) => void) | undefined;
}>();
</script>

<template>
  <ServerElementReader :form="form" :on-read="onRead" />
  <div data-testid="next-part" />
</template>
