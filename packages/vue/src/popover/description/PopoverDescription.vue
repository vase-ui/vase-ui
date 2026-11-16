<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface PopoverDescriptionState {}

export interface PopoverDescriptionProps
  extends
    VaseUIComponentProps<PopoverDescriptionState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the description. The popup uses it for `aria-describedby`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { usePopoverRootContext } from '../root/PopoverRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverDescriptionProps>(), { as: 'p' });

defineSlots<{
  default(props: { state: PopoverDescriptionState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverDescriptionState>;
}>();

const store = usePopoverRootContext();

const descriptionId = useVaseUiId(() => props.id);

const source = Symbol();

useRegisteredId(
  () => descriptionId.value,
  (getId) => store.context.registerDescriptionId(source, getId),
);

const state: PopoverDescriptionState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('p', props, {
  state,
  props: (attrs) => [{ id: descriptionId.value }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
