<script setup lang="ts">
import { computed, provide } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useModel } from '../common/model';
import { getFilter } from '../internals/filter';
import { useLocale } from '../locale-provider/part';
import { filterProviderKey } from './filter';
import type { MenuFilterProviderChangeEventDetails, MenuFilterProviderProps } from './types';

const props = withDefaults(defineProps<MenuFilterProviderProps>(), {
  modelValue: undefined,
  defaultValue: '',
  filter: undefined,
  autoHighlight: false,
  locale: undefined,
});
const emit = defineEmits<{
  /** The user changes the query. `details.cancel()` keeps it as it was. */
  valueChange: [value: string, details: MenuFilterProviderChangeEventDetails];
  /** Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: string];
}>();
defineSlots<{
  /** The `Menu.Root` or `Menu.SubmenuRoot` that filters its items. */
  default?(): unknown;
}>();

const query = useModel(() => props.modelValue, props.defaultValue);
const currentLocale = useLocale(() => props.locale);
const contains = computed(() => getFilter({ locale: currentLocale.value }).contains);

provide(filterProviderKey, {
  get query() {
    return query.value.value;
  },
  setQuery(value, reason, event) {
    const details = createChangeEventDetails(reason, event);
    emit('valueChange', value, details);
    if (details.isCanceled) return false;
    query.setOwn(value);
    emit('update:modelValue', value);
    return true;
  },
  get match() {
    if (props.filter === null) return null;
    return props.filter ?? ((text: string, value: string) => contains.value(text, value));
  },
  get autoHighlight() {
    return props.autoHighlight;
  },
});
</script>

<template>
  <slot />
</template>
