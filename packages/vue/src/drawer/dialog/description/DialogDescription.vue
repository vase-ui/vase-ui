<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../../internals/types';

export interface DialogDescriptionState {}

export interface DialogDescriptionProps
  extends
    VaseUIComponentProps<DialogDescriptionState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the description. The popup uses it for `aria-describedby`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../../common/empty';
import { useRegisteredId } from '../../../internals/labelable-provider/useRegisteredId';
import type { ComponentRenderFn, HTMLProps } from '../../../internals/types';
import { useVaseUiId } from '../../../internals/useVaseUiId';
import { useRenderElement } from '../../../internals/useRenderElement';
import { useDialogRootContext } from '../root/DialogRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogDescriptionProps>(), { as: 'p' });

defineSlots<{
  default(props: { state: DialogDescriptionState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogDescriptionState>;
}>();

const store = useDialogRootContext();

const descriptionId = useVaseUiId(() => props.id);

useRegisteredId(
  () => descriptionId.value,
  store.context.registerDescriptionId,
  () => element.value,
);

const state: DialogDescriptionState = EMPTY_OBJECT;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('p', props, {
  state,
  props: (attrs) => [{ id: descriptionId.value }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
