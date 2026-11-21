<script setup lang="ts">
import { computed, provide } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useModel } from '../common/model';
import { getFilter } from '../common/filter';
import { useLocale } from '../locale-provider/part';
import { filterProviderKey } from './filter';
import type { MenuFilterProviderEmits, MenuFilterProviderProps } from './types';

const props = withDefaults(defineProps<MenuFilterProviderProps>(), {
  modelValue: undefined,
  defaultValue: '',
  filter: undefined,
  autoHighlight: false,
  locale: undefined,
});
const emit = defineEmits<MenuFilterProviderEmits>();
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
