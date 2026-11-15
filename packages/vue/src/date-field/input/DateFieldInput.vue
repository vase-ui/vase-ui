<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { DateTimeFieldSegment } from '../../internals/date-time/field/DateTimeFieldContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { DateFieldRootState } from '../root/DateFieldRoot.vue';

/**
 * One part of the layout of the field. A segment that the user edits has `editable: true`. Each
 * other part has `editable: false` and a `text`: a separator, an era or the name of a time zone.
 */
export type DateFieldInputSegment = DateTimeFieldSegment;

export interface DateFieldInputState extends DateFieldRootState {}

export interface DateFieldInputProps
  extends
    VaseUIComponentProps<DateFieldInputState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { useDateTimeFieldContext } from '../../internals/date-time/field/DateTimeFieldContext';
import { rootStateAttributesMapping } from '../../internals/date-time/field/useDateTimeFieldRoot';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import DateFieldInputChildren from './DateFieldInputChildren.vue';
import { DateFieldInputElement } from './DateFieldInputElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateFieldInputProps>(), {
  as: 'div',
});

defineSlots<{
  /**
   * Renders one part of the layout. The default renders `DateField.Segment` for a segment that the
   * user edits, and `DateField.Literal` for each other part.
   */
  segment(props: { segment: DateFieldInputSegment; index: number }): unknown;
  render(props: { props: HTMLProps; state: DateFieldInputState; children: Component }): unknown;
}>();

const context = useDateTimeFieldContext();
const isHydrating = useIsHydrating();

const { state } = context;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: rootStateAttributesMapping,
  props: (attrs) => [
    {
      // The server can have another layout than the browser, so the number of parts can differ.
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
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="DateFieldInputChildren" />
  <DateFieldInputElement v-else :tag="as" :element-props="elementProps()" :segments="context.segments.value" :list-key="context.listKey.value"><template v-if="$slots.segment" #segment="slotProps"><slot name="segment" v-bind="slotProps" /></template></DateFieldInputElement>
</template>
