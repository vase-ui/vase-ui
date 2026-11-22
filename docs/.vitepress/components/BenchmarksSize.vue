<script setup lang="ts">
import { data } from '../../benchmarks.data.ts';
import { setupHeading } from './benchmarksFormat.ts';
import BenchmarksSizeTable from './BenchmarksSizeTable.vue';

defineProps<{
  /** `app`: the bytes of each app. `added`: each app minus the empty app of its setup. */
  measure: 'app' | 'added';
}>();

const UNIT_NAMES = { raw: 'Raw bytes', brotli: 'Brotli bytes' } as const;
</script>

<template>
  <template v-for="table in data.sizeTables" :key="table.setup">
    <h4>{{ setupHeading(table.setup) }}</h4>
    <BenchmarksSizeTable
      :table="table"
      :measure="measure"
      unit="gzip"
      :label="`${setupHeading(table.setup)}: gzip bytes`"
    />
    <details v-for="(unitName, unit) in UNIT_NAMES" :key="unit">
      <summary>{{ unitName }}</summary>
      <BenchmarksSizeTable
        :table="table"
        :measure="measure"
        :unit="unit"
        :label="`${setupHeading(table.setup)}: ${unitName.toLowerCase()}`"
      />
    </details>
  </template>
</template>
