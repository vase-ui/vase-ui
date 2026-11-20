<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../../internals/types';

export interface DialogTitleState {}

export interface DialogTitleProps
  extends
    VaseUIComponentProps<DialogTitleState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the title. The popup uses it for `aria-labelledby`.
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

const props = withDefaults(defineProps<DialogTitleProps>(), { as: 'h2' });

defineSlots<{
  default(props: { state: DialogTitleState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogTitleState>;
}>();

const store = useDialogRootContext();

const titleId = useVaseUiId(() => props.id);

useRegisteredId(
  () => titleId.value,
  store.context.registerTitleId,
  () => element.value,
);

const state: DialogTitleState = EMPTY_OBJECT;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('h2', props, {
  state,
  props: (attrs) => [{ id: titleId.value }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
