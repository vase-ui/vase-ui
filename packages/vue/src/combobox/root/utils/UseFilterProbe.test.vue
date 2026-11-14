<script setup lang="ts">
import { computed } from 'vue';
import { useComboboxFilter } from './useFilter';

const props = defineProps<{ locale?: string | undefined }>();

// `getFilter` keeps each filter, by locale and options, for all the cases of a file. `numeric`
// keeps the filters of this probe apart from those of the cases that do not render it. The filter
// for no locale thus keeps the runtime locale that the first case mocked, and a later case gets it.
const filter = useComboboxFilter(() => ({ locale: props.locale, numeric: true }));
const cities = ['Malmö', 'Malta', 'Oslo'];
const matches = computed(() => cities.filter((city) => filter.contains(city, 'malmo')));
</script>

<template>
  <ul data-testid="matches">
    <li v-for="city in matches" :key="city">{{ city }}</li>
  </ul>
</template>
