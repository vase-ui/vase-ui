<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ProgressRootState } from '../root/ProgressRoot.vue';

export interface ProgressLabelState extends ProgressRootState {}

export interface ProgressLabelProps
  extends
    VaseUIComponentProps<ProgressLabelState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the label. The root uses it for `aria-labelledby`.
   * A server render writes the attributes of the root before it renders the label.
   * The server HTML of the root then points at a generated id until the page hydrates.
   * A label with an `id` of its own does not name the root until then.
   * To correct this, set `aria-labelledby` on `Progress.Root` to the same id.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import {
  progressStateAttributesMapping,
  useProgressRootContext,
} from '../root/ProgressRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ProgressLabelProps>(), { as: 'span' });

defineSlots<{
  default(props: { state: ProgressLabelState }): unknown;
  render: ComponentRenderFn<HTMLProps, ProgressLabelState>;
}>();

const { labelRoot, state } = useProgressRootContext();

const labelId = useRegisteredLabelId(
  () => props.id,
  labelRoot,
  () => element.value,
);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
  state,
  props: (attrs) => [{ id: labelId.value, role: 'presentation' }, attrs],
  stateAttributesMapping: progressStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
