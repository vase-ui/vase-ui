<script setup lang="ts">
import { useIsHydrating } from '../../common/hydration';
import { markChildrenMounted } from '../../internals/useRenderElement';
import { inject } from 'vue';
import { CalendarSelectContext } from '../root/CalendarRootContext';

const context = inject(CalendarSelectContext, undefined);
if (!context) {
  throw new Error(
    'Vase UI: The options of a calendar select must be inside <Calendar.MonthSelect> or <Calendar.YearSelect>. Without the select the options have no months or years to show. Mount the `children` component of the `#render` slot inside the select.',
  );
}
const { options, selected } = context;
// The names of the months and the digits of the years come from the data of `Intl` in the engine,
// and a server and a browser can differ.
const isHydrating = useIsHydrating();

markChildrenMounted();
</script>

<template>
  <option
    v-for="option in options"
    :key="option.value"
    :value="option.value"
    :selected="option.value === selected"
    :disabled="option.disabled"
    :data-allow-mismatch="isHydrating ? 'text' : undefined"
  >
    {{ option.text }}
  </option>
</template>
