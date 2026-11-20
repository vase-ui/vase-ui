<script setup vapor lang="ts">
import { inject } from 'vue';
import { textKey } from './measureProvide';

const text = inject(textKey, () => 'none');
</script>

<template>
  <span>{{ text() }}</span>
</template>
