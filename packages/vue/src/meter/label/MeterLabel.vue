<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { MeterRootState } from '../root/MeterRoot.vue';

export interface MeterLabelState extends MeterRootState {}

export interface MeterLabelProps
  extends
    VaseUIComponentProps<MeterLabelState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the label. The root uses it for `aria-labelledby`.
   * A server render writes the attributes of the root before it renders the label.
   * The server HTML of the root then points at a generated id until the page hydrates.
   * A label with an `id` of its own does not name the root until then.
   * To correct this, set `aria-labelledby` on `Meter.Root` to the same id.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useMeterRootContext } from '../root/MeterRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MeterLabelProps>(), { as: 'span' });

defineSlots<{
  default(props: { state: MeterLabelState }): unknown;
  render: ComponentRenderFn<HTMLProps, MeterLabelState>;
}>();

const { setLabelId, defaultLabelId } = useMeterRootContext();

const labelId = useRegisteredLabelId(() => props.id, setLabelId, defaultLabelId);

const state: MeterLabelState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('span', props, {
  state,
  props: (attrs) => [{ id: labelId.value, role: 'presentation' }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
