<script setup lang="ts">
import DateFieldRoot from '../date-field/DateFieldRoot.vue';
import { useRangeField } from './field';
import type { DateRangePickerEndFieldProps, DateRangePickerEndFieldState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<DateRangePickerEndFieldProps>();
defineSlots<{ default?(scope: { state: DateRangePickerEndFieldState }): unknown }>();

const { field, fieldProps, exposed } = useRangeField(1, 'EndField');

defineExpose(exposed);
</script>

<template>
  <DateFieldRoot :ref="field.setField" v-bind="fieldProps()">
    <template #default="{ state }">
      <slot :state="state" />
    </template>
  </DateFieldRoot>
</template>
