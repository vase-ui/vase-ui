<script setup lang="ts">
import type { SizeTable } from '../../../scripts/docs/benchmarksReport.ts';
import { data } from '../../benchmarks.data.ts';
import { sizeCellText } from './benchmarksFormat.ts';
import ScrollBox from './ScrollBox.vue';

const props = defineProps<{
  table: SizeTable;
  /** `app`: the bytes of each app. `added`: each app minus the empty app of its setup. */
  measure: 'app' | 'added';
  unit: 'raw' | 'gzip' | 'brotli';
  /** The accessible name of the table. */
  label: string;
}>();

function nameOf(id: string): string {
  const library = data.libraries.find((item) => item.id === id);
  return library?.id === 'base-ui' ? `${library.name} (React)` : (library?.name ?? id);
}

const rows = props.measure === 'app' ? props.table.rows : props.table.rows.slice(1);
</script>

<template>
  <ScrollBox :label="label">
    <table>
      <thead>
        <tr>
          <th scope="col">App</th>
          <th v-for="column in table.columns" :key="column" scope="col">{{ nameOf(column) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.scenario">
          <th scope="row">{{ row.label }}</th>
          <td v-for="column in table.columns" :key="column">
            {{ sizeCellText(row[measure][column], unit) }}
          </td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
</template>
