<script setup lang="ts">
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useCalendarMonthContext } from './CalendarMonthContext';

// A part that names the grid of its month as a caption does.
const { setLabelId, defaultLabelId } = useCalendarMonthContext();
const id = useRegisteredLabelId(() => undefined, setLabelId, defaultLabelId);
</script>

<template>
  <div :id="id" data-testid="caption">Custom caption</div>
</template>
