<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  DateTimeFieldRootState,
  DateTimeFieldSegment,
} from '../../internals/date-time/field/DateTimeFieldContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface TimeFieldLiteralState extends DateTimeFieldRootState {
  /**
   * The type of the item: `literal`, or `timeZoneName` for the name of the time zone.
   */
  type: 'literal' | 'era' | 'timeZoneName';
  /**
   * The position of the item in the layout.
   */
  index: number;
}

export interface TimeFieldLiteralProps
  extends
    VaseUIComponentProps<TimeFieldLiteralState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The item of the layout that this part shows, with the text to show. `TimeField.Input` gives it
   * to its `#segment` slot when the item is not editable.
   */
  segment: Extract<DateTimeFieldSegment, { editable: false }>;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { useDateTimeFieldContext } from '../../internals/date-time/field/DateTimeFieldContext';
import {
  DateTimeFieldLiteralElement,
  useDateTimeFieldLiteral,
} from '../../internals/date-time/field/DateTimeFieldLiteralElement';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { fieldValidityMapping } from '../../internals/field-constants';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const stateAttributesMapping: StateAttributesMapping<TimeFieldLiteralState> = {
  index: () => null,
  ...fieldValidityMapping,
};

const props = withDefaults(defineProps<TimeFieldLiteralProps>(), { as: 'span' });

defineSlots<{
  render: ComponentRenderFn<HTMLProps, TimeFieldLiteralState>;
}>();

const context = useDateTimeFieldContext();
const isHydrating = useIsHydrating();

const state = computed<TimeFieldLiteralState>(() => ({
  ...context.state.value,
  type: props.segment.type,
  index: props.segment.index,
}));

const setElement = useDateTimeFieldLiteral(() => props.segment.index);

const { element, elementProps, usesRenderSlot } = useRenderElement('span', props, {
  state,
  stateAttributesMapping,
  ref: setElement,
  props: (attrs) => [
    {
      // The text between the segments is not for assistive technology. The time zone name is.
      'aria-hidden': props.segment.type === 'literal' ? true : undefined,
      // The server can have another text than the browser.
      'data-allow-mismatch': isHydrating.value ? 'text' : undefined,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <DateTimeFieldLiteralElement
    v-else
    :tag="as"
    :element-props="elementProps()"
    :text="segment.text"
  />
</template>
