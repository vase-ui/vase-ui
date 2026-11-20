<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { LocaleProvider } from '../../src/locale-provider';
import ComboboxFilterUser from './ComboboxFilterUser.vue';

// Exposes the filter of `useFilter` of the family, in a `LocaleProvider` with `locale`.
defineProps({
  family: { type: String as PropType<'combobox' | 'autocomplete'>, default: 'combobox' },
  options: Object as PropType<Record<string, unknown>>,
  locale: String,
});
const user = useTemplateRef<InstanceType<typeof ComboboxFilterUser>>('user');
defineExpose({
  get filter() {
    return user.value?.filter;
  },
});
</script>

<template>
  <LocaleProvider v-if="locale" :locale="locale">
    <ComboboxFilterUser ref="user" :family="family" :options="options" />
  </LocaleProvider>
  <ComboboxFilterUser v-else ref="user" :family="family" :options="options" />
</template>
