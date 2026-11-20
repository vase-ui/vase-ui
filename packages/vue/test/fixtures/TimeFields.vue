<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { TimeField } from '../../src/time-field';

defineProps({
  fields: { type: Array as PropType<Record<string, unknown>[]>, required: true },
  formAttrs: Object as PropType<Record<string, unknown>>,
  /** Renders `TimeField.Clear` with this text. */
  clear: String,
  /** Renders each segment and literal in its `element` slot, with a class and a placeholder. */
  elementSlots: Boolean,
});
const roots = useTemplateRef('roots');
defineExpose({ roots });
</script>

<template>
  <form v-bind="formAttrs">
    <TimeField.Root v-for="(field, index) in fields" ref="roots" :key="index" v-bind="field">
      <TimeField.Input>
        <template v-if="elementSlots" #segment="{ segment }">
          <TimeField.Segment v-if="segment.editable" :segment="segment" class="Part">
            <template #element="slot">
              <input v-bind="slot.props" :ref="slot.elementRef" class="Mine" placeholder="?" />
            </template>
          </TimeField.Segment>
          <TimeField.Literal v-else :segment="segment" class="Part">
            <template #element="slot">
              <b v-bind="slot.props" :ref="slot.elementRef" class="Mine">{{ segment.text }}</b>
            </template>
          </TimeField.Literal>
        </template>
      </TimeField.Input>
      <TimeField.Clear v-if="clear" aria-label="Clear">{{ clear }}</TimeField.Clear>
    </TimeField.Root>
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </form>
</template>
