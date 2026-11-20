<script setup lang="ts">
import type { PropType } from 'vue';
import { PreviewCard } from '../../src/preview-card';

type Props = Record<string, unknown>;

// A paragraph 300 px wide with links of one root that wrap: `overlap` has two lines that overlap
// on the x axis, `parts` has two parts that do not overlap, and `long` has more lines, with a
// `<b>`, an `<i>` and text of two directions. `one` has one line. The popup is 80 px by 40 px.
defineProps({
  root: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
});
</script>

<template>
  <PreviewCard.Root v-bind="root">
    <p style="width: 300px; margin: 40px; font: 16px/24px sans-serif">
      Some words
      <PreviewCard.Trigger id="overlap" href="#overlap" v-bind="trigger">
        a link of two lines that overlap on the x axis because it is long
      </PreviewCard.Trigger>
      and the rest.
    </p>
    <p style="width: 300px; margin: 40px; font: 16px/24px sans-serif">
      Some words that fill the line
      <PreviewCard.Trigger id="parts" href="#parts" v-bind="trigger">
        a link of two parts
      </PreviewCard.Trigger>
      and the rest of the text.
    </p>
    <p style="width: 140px; margin: 40px; font: 16px/24px sans-serif">
      <PreviewCard.Trigger id="long" href="#long" v-bind="trigger">
        This is <b>a long text</b> that wraps <i>across more</i> lines שלום עולם here
      </PreviewCard.Trigger>
    </p>
    <p style="margin: 40px; font: 16px/24px sans-serif">
      <PreviewCard.Trigger id="one" href="#one" v-bind="trigger">One line</PreviewCard.Trigger>
    </p>
    <PreviewCard.Portal v-bind="portal">
      <PreviewCard.Positioner data-testid="positioner" v-bind="positioner">
        <PreviewCard.Popup data-testid="popup" style="width: 80px; height: 40px">
          Card
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  </PreviewCard.Root>
</template>
