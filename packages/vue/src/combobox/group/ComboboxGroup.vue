<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ComboboxGroupState {}

export interface ComboboxGroupProps
  extends
    VaseUIComponentProps<ComboboxGroupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Items to be rendered within this group.
   * When provided, child `Collection` components will use these items.
   */
  items?: readonly any[] | undefined;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { provideGroupCollectionContext } from '../collection/GroupCollectionContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { ComboboxGroupContext } from './ComboboxGroupContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxGroupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ComboboxGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxGroupState>;
}>();

const store = useComboboxRootContext();

// The registry keeps the id of each label by its source. A template can mount a new label before it
// unmounts the label that it replaces, so a removal by `id` would remove the id of the new label.
const { ids, registerId } = createIdRegistry();
const labelId = computed(() => ids.value.at(-1));

provide(ComboboxGroupContext, {
  labelId,
  registerLabelId: registerId,
  items: computed(() => props.items),
});
provideGroupCollectionContext(() => props.items);

const state: ComboboxGroupState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      // `group` is not a valid owned element of `grid`, and `row` must be owned
      // by `grid`, `rowgroup`, or `treegrid`.
      role: store.select('grid') ? 'rowgroup' : 'group',
      'aria-labelledby': labelId.value,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
