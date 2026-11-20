<script setup lang="ts">
import DateFieldRoot from '../date-field/DateFieldRoot.vue';
import { useRangeField } from './field';
import type { DateRangePickerStartFieldProps, DateRangePickerStartFieldState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<DateRangePickerStartFieldProps>();
defineSlots<{ default?(scope: { state: DateRangePickerStartFieldState }): unknown }>();

const { field, fieldProps, exposed } = useRangeField(0, 'StartField');

defineExpose(exposed);
</script>

<template>
  <DateFieldRoot :ref="field.setField" v-bind="fieldProps()">
    <template #default="{ state }">
      <slot :state="state" />
    </template>
  </DateFieldRoot>
</template>
