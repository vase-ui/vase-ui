<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface SelectGroupState {}

export interface SelectGroupProps
  extends
    VaseUIComponentProps<SelectGroupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { SelectGroupContext } from './SelectGroupContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectGroupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SelectGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectGroupState>;
}>();

// The group binds the id of its label, which comes after it.
useDeferredServerRender();

// The registry keeps the id of each label by its source. A template can mount a new label before it
// unmounts the label that it replaces, so a removal by `id` would remove the id of the new label.
const { ids, registerId } = createIdRegistry();
const labelId = computed(() => ids.value.at(-1));

provide(SelectGroupContext, { labelId, registerLabelId: registerId });

const state: SelectGroupState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ role: 'group', 'aria-labelledby': labelId.value }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
