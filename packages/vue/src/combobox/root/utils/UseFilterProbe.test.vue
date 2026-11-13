<script setup lang="ts">
import { computed } from 'vue';
import { useComboboxFilter } from './useFilter';

const props = defineProps<{ locale?: string | undefined }>();

// `getFilter` keeps one filter for each locale and set of options. `numeric` makes the filters of
// this probe new, so each case makes them with its own runtime locale.
const filter = useComboboxFilter(() => ({ locale: props.locale, numeric: true }));
const cities = ['Malmö', 'Malta', 'Oslo'];
const matches = computed(() => cities.filter((city) => filter.contains(city, 'malmo')));
</script>

<template>
  <ul data-testid="matches">
    <li v-for="city in matches" :key="city">{{ city }}</li>
  </ul>
</template>
