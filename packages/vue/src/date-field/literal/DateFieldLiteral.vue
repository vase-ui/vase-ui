<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { DateFieldInputSegment } from '../input/DateFieldInput.vue';
import type { DateFieldRootState } from '../root/DateFieldRoot.vue';

export interface DateFieldLiteralState extends DateFieldRootState {
  /**
   * The type of the text: a separator, an era or the name of a time zone.
   */
  type: 'literal' | 'era' | 'timeZoneName';
}

export interface DateFieldLiteralProps
  extends
    VaseUIComponentProps<DateFieldLiteralState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The part of the layout to show: a separator, an era or a time zone name. The `segment` slot of
   * `DateField.Input` gives it.
   */
  segment: Extract<DateFieldInputSegment, { editable: false }>;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { useDateTimeFieldContext } from '../../internals/date-time/field/DateTimeFieldContext';
import { DateTimeFieldLiteralElement } from '../../internals/date-time/field/DateTimeFieldLiteralElement';
import { useDateTimeFieldLiteral } from '../../internals/date-time/field/useDateTimeFieldLiteral';
import { rootStateAttributesMapping } from '../../internals/date-time/field/useDateTimeFieldRoot';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<DateFieldLiteralProps>(), {
  as: 'span',
});

defineSlots<{
  render: ComponentRenderFn<HTMLProps, DateFieldLiteralState>;
}>();

const context = useDateTimeFieldContext();
const isHydrating = useIsHydrating();

const state = computed<DateFieldLiteralState>(() => ({
  ...context.state.value,
  type: props.segment.type,
}));

const setElement = useDateTimeFieldLiteral(() => props.segment.index);

const { element, elementProps, usesRenderSlot } = useRenderElement('span', props, {
  state,
  stateAttributesMapping: rootStateAttributesMapping,
  ref: setElement,
  props: (attrs) => [
    {
      // An era and a zone name tell something that a screen reader must read.
      'aria-hidden': props.segment.type === 'literal' ? true : undefined,
      // The server can have another text for the separator.
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
