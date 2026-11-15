<script setup lang="ts">
import { useIsHydrating } from '../../common/hydration';
import { markChildrenMounted } from '../../internals/useRenderElement';
import { useCalendarSelectContext } from '../utils/CalendarSelectContext';

const { options, selected } = useCalendarSelectContext();
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
