<script setup lang="ts">
import { useAttrs } from 'vue';
import {
  useControlLabelId,
  useLabelableContext,
  useLabelableId,
} from '../../src/internals/labelable-provider';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    id?: string | null | undefined;
    enabled?: boolean;
  }>(),
  { enabled: true },
);

const attrs = useAttrs();
const { getDescriptionProps } = useLabelableContext();
const controlId = useLabelableId({ id: () => props.id, enabled: () => props.enabled });
const labelledBy = useControlLabelId();

function elementProps() {
  return getDescriptionProps({
    role: 'checkbox',
    tabindex: '0',
    id: controlId.value,
    'aria-labelledby': labelledBy.value,
    ...attrs,
  });
}
</script>

<template>
  <span v-bind="elementProps()"><slot /></span>
</template>
