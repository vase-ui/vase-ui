<script setup lang="ts">
import { shallowRef, useAttrs } from 'vue';
import {
  useAriaLabelledBy,
  useControlLabelId,
  useLabelableId,
} from '../../src/internals/labelable-provider';

defineOptions({ inheritAttrs: false });

// The composable watches these attributes, so they are props.
const props = withDefaults(
  defineProps<{
    id?: string | undefined;
    ariaLabel?: string | undefined;
    ariaLabelledby?: string | undefined;
    enableFallback?: boolean | undefined;
  }>(),
  { enableFallback: true },
);

const attrs = useAttrs();
const inputId = useLabelableId({ id: () => props.id });
const inputElement = shallowRef<HTMLInputElement | null>(null);
const labelledBy = useAriaLabelledBy(
  () => props.ariaLabelledby,
  useControlLabelId(),
  inputElement,
  () => props.enableFallback,
  inputId,
  () => props.ariaLabel,
);

function setInputElement(element: unknown) {
  inputElement.value = element as HTMLInputElement | null;
}

function elementProps() {
  return {
    role: 'checkbox',
    tabindex: '0',
    'aria-label': props.ariaLabel,
    'aria-labelledby': labelledBy.value,
    ...attrs,
  };
}
</script>

<template>
  <span v-bind="elementProps()"><slot /></span>
  <input :id="inputId" :ref="setInputElement" type="checkbox" aria-hidden="true" tabindex="-1" />
</template>
