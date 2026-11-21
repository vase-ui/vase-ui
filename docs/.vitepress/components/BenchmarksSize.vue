<script setup lang="ts">
import { data } from '../../benchmarks.data.ts';
import BenchmarksSizeTable from './BenchmarksSizeTable.vue';

defineProps<{
  /** `app`: the bytes of each app. `added`: each app minus the empty app of its setup. */
  measure: 'app' | 'added';
}>();

const UNIT_NAMES = { raw: 'Raw bytes', brotli: 'Brotli bytes' } as const;

function headingOf(setup: string): string {
  const found = data.setups.find((item) => item.id === setup);
  return found === undefined ? setup : `${found.name}, Vue ${found.version}`;
}
</script>

<template>
  <template v-for="table in data.sizeTables" :key="table.setup">
    <h4>{{ headingOf(table.setup) }}</h4>
    <BenchmarksSizeTable
      :table="table"
      :measure="measure"
      unit="gzip"
      :label="`${headingOf(table.setup)}: gzip bytes`"
    />
    <details v-for="(unitName, unit) in UNIT_NAMES" :key="unit">
      <summary>{{ unitName }}</summary>
      <BenchmarksSizeTable
        :table="table"
        :measure="measure"
        :unit="unit"
        :label="`${headingOf(table.setup)}: ${unitName.toLowerCase()}`"
      />
    </details>
  </template>
</template>
