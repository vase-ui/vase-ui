<script lang="ts">
export interface TemporalPartProps {
  value?: Temporal.PlainDate | undefined;
}
</script>

<script setup lang="ts">
const props = defineProps<TemporalPartProps>();
</script>

<template>
  <div data-temporal-part>{{ props.value?.toString() }}</div>
</template>
