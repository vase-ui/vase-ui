<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface FieldsetLegendState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetLegendProps
  extends
    VaseUIComponentProps<FieldsetLegendState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the legend. The root uses it for `aria-labelledby`.
   * A server render writes the attributes of the root before it renders the legend.
   * The server HTML of the root then points at a generated id until the page hydrates.
   * A legend with an `id` of its own does not name the root until then.
   * To correct this, set `aria-labelledby` on `Fieldset.Root` to the same id.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useFieldsetRootContext } from '../root/FieldsetRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FieldsetLegendProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: FieldsetLegendState }): unknown;
  render: ComponentRenderFn<HTMLProps, FieldsetLegendState>;
}>();

const { setLegendId, defaultLegendId, disabled } = useFieldsetRootContext();

const legendId = useRegisteredLabelId(() => props.id, setLegendId, defaultLegendId);

const state = computed<FieldsetLegendState>(() => ({ disabled: disabled.value }));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ id: legendId.value }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
