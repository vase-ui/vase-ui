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
import { useDateTimeFieldContext } from '../../internals/date-time/field/DateTimeFieldContext';
import { fieldValidityMapping } from '../../internals/field-constants';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
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

const state = computed<TimeFieldLiteralState>(() => ({
  ...context.state.value,
  type: props.segment.type,
  index: props.segment.index,
}));

// The server can have another text than the browser. Vue lets `data-allow-mismatch="text"` allow only
// an element that has a string as its one child, and a dynamic component gets its children in a
// slot. The part thus binds the text as the prop `textContent`. Vue replaces a dynamic prop while it
// hydrates, and it compares no `textContent`, so a text that differs gives no message.
const { element, elementProps } = useRenderElement('span', props, {
  state,
  stateAttributesMapping,
  props: (attrs) => [
    // The text between the segments is not for assistive technology. The time zone name is.
    { 'aria-hidden': props.segment.type === 'literal' ? true : undefined },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :textContent="segment.text" />
</template>
