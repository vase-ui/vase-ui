<script setup lang="ts">
import type { TimeTable, TimeTableCell } from '../../../scripts/docs/benchmarksReport.ts';
import { columnName, formatInterval, formatMeasure, formatRatio } from './benchmarksFormat.ts';
import BenchmarksNoteLink from './BenchmarksNoteLink.vue';
import ScrollBox from './ScrollBox.vue';

const props = defineProps<{
  table: TimeTable;
  /** The accessible name of the table. */
  label: string;
}>();

const VERDICTS = {
  ms: { slower: 'Slower', faster: 'Faster', none: 'No difference above 5% detected' },
  bytes: { slower: 'More', faster: 'Less', none: 'No difference above 5% detected' },
} as const;

/**
 * The first line of a cell, in bold, and the lines below it. `note` is the note of a verdict where
 * Vase UI loses, which the last line links.
 */
function textOf(
  cell: TimeTableCell | undefined,
  unit: 'ms' | 'bytes',
): { first: string; lines: string[]; note?: string | undefined } {
  if (cell === undefined || cell === 'not-measured') {
    return { first: 'Not measured yet', lines: [] };
  }
  if (cell === 'not-provided') {
    return { first: 'Not provided', lines: [] };
  }
  if (cell.kind === 'failed') {
    return { first: 'Fails', lines: [cell.reason] };
  }
  const lines = [`p90 ${formatMeasure(cell.p90, unit)}`];
  if (cell.comparison) {
    lines.push(
      `${formatRatio(cell.comparison.ratio)} Vase UI (${formatInterval(cell.comparison.interval)})`,
      VERDICTS[unit][cell.comparison.verdict],
    );
  }
  return { first: formatMeasure(cell.median, unit), lines, note: cell.note };
}

const rows = props.table.rows.map((row) => ({
  metric: row.metric,
  label: row.label,
  texts: props.table.columns.map((column) => ({
    column,
    ...textOf(row.cells[column], row.unit),
  })),
}));
</script>

<template>
  <ScrollBox :label="label">
    <table>
      <thead>
        <tr>
          <th scope="col">Measure</th>
          <th v-for="column in table.columns" :key="column" scope="col">
            {{ columnName(column) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.metric">
          <th scope="row">{{ row.label }}</th>
          <td v-for="text in row.texts" :key="text.column">
            <strong>{{ text.first }}</strong>
            <template v-for="(line, index) in text.lines" :key="line"
              ><br />{{ line
              }}<BenchmarksNoteLink
                v-if="text.note && index === text.lines.length - 1"
                :note="text.note"
            /></template>
          </td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
</template>
