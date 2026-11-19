<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type { DateTimeFieldSegmentState } from '../../internals/date-time/field/useDateTimeFieldSegment';
import type { EditableDateTimeFieldSegment } from '../../internals/date-time/field/useDateTimeFieldSegment';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export type TimeFieldSegmentState = DateTimeFieldSegmentState;

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
// With it, `defineProps` gives the error TS2590.
interface TimeFieldSegmentAutocomplete {
  autocomplete?: string | null | undefined;
}

export interface TimeFieldSegmentProps
  extends
    VaseUIComponentProps<TimeFieldSegmentState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<InputHTMLAttributes>, 'autocomplete'>,
    /* @vue-ignore */ TimeFieldSegmentAutocomplete {
  /**
   * The editable item of the layout that this part shows. `TimeField.Input` gives it to its
   * `#segment` slot.
   */
  segment: EditableDateTimeFieldSegment;
}
</script>

<script setup lang="ts">
import {
  segmentStateAttributesMapping,
  useDateTimeFieldSegment,
} from '../../internals/date-time/field/useDateTimeFieldSegment';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeFieldSegmentProps>(), { as: 'input' });

defineSlots<{
  render: ComponentRenderFn<InputHTMLAttributes & Pick<HTMLProps, 'ref'>, TimeFieldSegmentState>;
}>();

const {
  state,
  props: segmentProps,
  setElement,
} = useDateTimeFieldSegment(() => props.segment, props);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('input', props, {
  state,
  stateAttributesMapping: segmentStateAttributesMapping,
  ref: setElement,
  props: (attrs) => [segmentProps.value, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef" />
</template>
