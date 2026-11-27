<script setup lang="ts">
import type { TimeGroup, TimeRun } from '../../../scripts/docs/benchmarksReport.ts';
import { data } from '../../benchmarks.data.ts';
import { engineName, setupHeading } from './benchmarksFormat.ts';
import BenchmarksTimeTable from './BenchmarksTimeTable.vue';

const props = defineProps<{
  group: TimeGroup;
}>();

function headingOf(run: TimeRun): string {
  const slowdown = run.cpuThrottle === null ? '' : `, CPU ${String(run.cpuThrottle)} times slower`;
  return `${setupHeading(run.setup)}: ${engineName(run.engine)} ${run.browserVersion}${slowdown}`;
}

const tables = data.timeTables
  .filter((table) => table.group === props.group)
  .map((table) => ({ table, heading: headingOf(table.run) }));
</script>

<template>
  <p v-if="tables.length === 0">Not measured yet.</p>
  <template v-for="{ table, heading } in tables" :key="heading">
    <h5>{{ heading }}</h5>
    <BenchmarksTimeTable :table="table" :label="heading" />
  </template>
</template>
