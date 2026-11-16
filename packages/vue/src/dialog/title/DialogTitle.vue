<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

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
import { EMPTY_OBJECT } from '../../common/empty';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useDialogRootContext } from '../root/DialogRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DialogTitleProps>(), { as: 'h2' });

defineSlots<{
  default(props: { state: DialogTitleState }): unknown;
  render: ComponentRenderFn<HTMLProps, DialogTitleState>;
}>();

const store = useDialogRootContext();

const titleId = useVaseUiId(() => props.id);

const source = Symbol();

useRegisteredId(
  () => titleId.value,
  (getId) => store.context.registerTitleId(source, getId),
);

const state: DialogTitleState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('h2', props, {
  state,
  props: (attrs) => [{ id: titleId.value }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
