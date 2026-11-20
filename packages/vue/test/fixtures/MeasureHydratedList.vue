<script setup lang="ts">
import type { PropType } from 'vue';
import MeasureHydratedLiteral from './MeasureHydratedLiteral.vue';
import MeasureHydratedSegment from './MeasureHydratedSegment.vue';

export interface MeasuredItem {
  /** An input with `attrs` and `value`, else a span with `text`. */
  input: boolean;
  attrs?: Record<string, string>;
  value?: string;
  text?: string;
  hidden?: boolean;
}

// A list of inputs and spans in the forms of a date field, with plain Vue. `allow` gives the list
// and the inputs `data-allow-mismatch`, and `write` writes the attributes of an input after the
// mount.
defineProps({
  items: { type: Array as PropType<MeasuredItem[]>, required: true },
  allow: Boolean,
  write: Boolean,
});
</script>

<template>
  <div class="Box" :data-allow-mismatch="allow ? 'children' : undefined">
    <template v-for="(item, index) in items" :key="index">
      <MeasureHydratedSegment
        v-if="item.input"
        :attrs="item.attrs ?? {}"
        :value="item.value ?? ''"
        :allow="allow"
        :write="write"
      />
      <MeasureHydratedLiteral v-else :text="item.text ?? ''" :hidden="item.hidden" />
    </template>
  </div>
</template>
