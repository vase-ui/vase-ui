<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { DateField } from '../../src/date-field';
import StyledButton from './StyledButton.vue';

defineProps({ date: Object as PropType<Record<string, unknown>> });
const root = useTemplateRef('root');
const input = useTemplateRef('input');
const clear = useTemplateRef('clear');
defineExpose({ root, input, clear });
</script>

<template>
  <DateField.Root ref="root" v-bind="date">
    <DateField.Input ref="input">
      <template #element="{ props, elementRef, state, segments }">
        <section
          v-bind="props"
          :ref="elementRef"
          :data-items="segments.length"
          :data-empty-field="state.empty"
        >
          <template v-for="(segment, index) in segments" :key="index">
            <DateField.Segment v-if="segment.editable" :segment="segment" class="Part">
              <template #element="slot">
                <input
                  v-bind="slot.props"
                  :ref="slot.elementRef"
                  class="Segment"
                  placeholder="?"
                  :data-placeholder-shown="slot.state.placeholder"
                />
              </template>
            </DateField.Segment>
            <DateField.Literal v-else :segment="segment" class="Part">
              <template #element="slot">
                <b v-bind="slot.props" :ref="slot.elementRef" class="Literal">{{ segment.text }}</b>
              </template>
            </DateField.Literal>
          </template>
        </section>
      </template>
    </DateField.Input>
    <DateField.Clear ref="clear" aria-label="Clear">
      <template #element="{ props, elementRef, state }">
        <StyledButton v-bind="props" :ref="elementRef" :data-cleared="state.empty">×</StyledButton>
      </template>
    </DateField.Clear>
  </DateField.Root>
</template>
