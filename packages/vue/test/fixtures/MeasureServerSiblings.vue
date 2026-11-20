<script setup lang="ts">
import { provide } from 'vue';
import MeasureServerSibling from './MeasureServerSibling.vue';

// Three siblings. With `prefetch`, each one calls `onServerPrefetch` in `setup`.
defineProps<{ prefetch?: boolean; showNames?: boolean }>();
provide('names', []);
</script>

<template>
  <div>
    <MeasureServerSibling name="a" :prefetch="prefetch" :show-names="showNames" />
    <MeasureServerSibling name="b" :prefetch="prefetch" :show-names="showNames" />
    <MeasureServerSibling name="c" :prefetch="prefetch" :show-names="showNames" />
  </div>
</template>
