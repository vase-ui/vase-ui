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
import { useElementId } from '../../utils/popups/useElementId';
import { usePopoverRootContext } from '../root/PopoverRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverDescriptionProps>(), { as: 'p' });

defineSlots<{
  default(props: { state: PopoverDescriptionState }): unknown;
  render: ComponentRenderFn<HTMLProps, PopoverDescriptionState>;
}>();

const store = usePopoverRootContext();

const descriptionId = useVaseUiId(() => props.id);

const state: PopoverDescriptionState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('p', props, {
  state,
  props: (attrs) => [{ id: descriptionId.value }, attrs],
});

// The `#render` slot can give the element another id. An empty id names no element.
const elementId = useElementId(element);

const source = Symbol();

useRegisteredId(
  () => elementId.value || undefined,
  (getId) => store.context.registerDescriptionId(source, getId),
);

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
