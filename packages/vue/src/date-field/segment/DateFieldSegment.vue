<script lang="ts">
import type { InputHTMLAttributes } from 'vue';
import type {
  DateTimeFieldSegmentState,
  EditableDateTimeFieldSegment,
} from '../../internals/date-time/field/useDateTimeFieldSegment';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface DateFieldSegmentState extends DateTimeFieldSegmentState {}

// The type of `autocomplete` in `InputHTMLAttributes` is a union that is too large for vue-tsc.
// With it, `defineProps` gives the error TS2590.
interface DateFieldSegmentAutocomplete {
  autocomplete?: string | null | undefined;
}

export interface DateFieldSegmentProps
  extends
    VaseUIComponentProps<DateFieldSegmentState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<InputHTMLAttributes>, 'autocomplete'>,
    /* @vue-ignore */ DateFieldSegmentAutocomplete {
  /**
   * The segment to edit. The `segment` slot of `DateField.Input` gives it.
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

const props = withDefaults(defineProps<DateFieldSegmentProps>(), {
  as: 'input',
});

defineSlots<{
  render: ComponentRenderFn<HTMLProps & InputHTMLAttributes, DateFieldSegmentState>;
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
