<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface SelectSeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export interface SelectSeparatorProps
  extends
    VaseUIComponentProps<SelectSeparatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import ListboxSeparator from '../../utils/listbox-separator/ListboxSeparator.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectSeparatorProps>(), {
  as: 'div',
  orientation: 'horizontal',
});

defineSlots<{
  default(props: { state: SelectSeparatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectSeparatorState>;
}>();

// As in Base UI, this part renders `ListboxSeparator` and makes no element of its own.
const separator = useTemplateRef('separator');
const element = computed(() => separator.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <ListboxSeparator ref="separator" v-bind="{ ...$attrs, ...props }">
    <template v-if="$slots.render" #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </ListboxSeparator>
</template>
