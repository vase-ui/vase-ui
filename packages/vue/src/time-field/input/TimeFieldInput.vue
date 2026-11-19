<script lang="ts">
import type { Component, HTMLAttributes } from 'vue';
import type { DateTimeFieldSegment } from '../../internals/date-time/field/DateTimeFieldContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TimeFieldRootState } from '../root/TimeFieldRoot.vue';

export type TimeFieldInputState = TimeFieldRootState;

/**
 * An item of the layout of the field. An editable item is a segment with a number. An item that is
 * not editable is the text between segments, or the name of the time zone.
 */
export type TimeFieldInputSegment = DateTimeFieldSegment;

export interface TimeFieldInputProps
  extends
    VaseUIComponentProps<TimeFieldInputState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { useIsHydrating } from '../../common/hydration';
import { useDateTimeFieldContext } from '../../internals/date-time/field/DateTimeFieldContext';
import { rootStateAttributesMapping } from '../../internals/date-time/field/useDateTimeFieldRoot';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import TimeFieldInputChildren from './TimeFieldInputChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeFieldInputProps>(), { as: 'div' });

defineSlots<{
  /**
   * Renders one item of the layout. The default is `TimeField.Segment` for an editable item and
   * `TimeField.Literal` for each other item.
   */
  segment?(props: { segment: TimeFieldInputSegment; index: number }): unknown;
  render(props: { props: HTMLProps; state: TimeFieldInputState; children: Component }): unknown;
}>();

const context = useDateTimeFieldContext();
const isHydrating = useIsHydrating();

const { state } = context;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: rootStateAttributesMapping,
  props: (attrs) => [
    {
      // The server can have another layout than the browser. The segments then make the elements again
      // after the mount.
      'data-allow-mismatch': isHydrating.value ? 'children' : undefined,
      onMousedown: context.handleInputPress,
    },
    attrs,
  ],
  children: true,
});


defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="TimeFieldInputChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <TimeFieldInputChildren><template v-if="$slots.segment" #segment="slotProps"><slot name="segment" v-bind="slotProps" /></template></TimeFieldInputChildren>
  </component>
</template>
