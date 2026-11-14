<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ComboboxSeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export interface ComboboxSeparatorProps
  extends
    VaseUIComponentProps<ComboboxSeparatorState>,
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

const props = withDefaults(defineProps<ComboboxSeparatorProps>(), {
  as: 'div',
  orientation: 'horizontal',
});

defineSlots<{
  default(props: { state: ComboboxSeparatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxSeparatorState>;
}>();

// As in Base UI, this part renders `ListboxSeparator` and makes no element of its own.
// The template has one form for `#render` and one for the content. A `v-if` on a slot template
// makes the slots of `ListboxSeparator` dynamic. Vue then renders `ListboxSeparator` again each
// time this part renders. It also renders again each part in that slot that has slot content.
const separator = useTemplateRef('separator');
const element = computed(() => separator.value?.element ?? null);

defineExpose({ element });
</script>

<template>
  <ListboxSeparator v-if="$slots.render" ref="separator" v-bind="{ ...$attrs, ...props }">
    <template #render="slotProps">
      <slot name="render" v-bind="slotProps" />
    </template>
  </ListboxSeparator>
  <ListboxSeparator v-else ref="separator" v-bind="{ ...$attrs, ...props }">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </ListboxSeparator>
</template>
