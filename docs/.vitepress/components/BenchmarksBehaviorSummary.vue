<script setup lang="ts">
import { data } from '../../benchmarks.data.ts';
import { columnName } from './benchmarksFormat.ts';
import BenchmarksNoteLink from './BenchmarksNoteLink.vue';
import ScrollBox from './ScrollBox.vue';

const { columns } = data.behaviorSummary;
const rows = data.behaviorSummary.rows.map((row) => ({
  ...row,
  texts: columns.map((column) => {
    const cell = row.cells[column];
    return {
      column,
      text:
        cell === undefined || cell === 'not-measured'
          ? 'Not measured yet'
          : cell === 'not-provided'
            ? 'Not provided'
            : `${String(cell.passes)} of ${String(cell.checks)}`,
      loss: typeof cell === 'object' ? cell.loss : undefined,
    };
  }),
}));
</script>

<template>
  <p v-if="data.behaviorRuns.length === 0">The behavior checks are not measured yet.</p>
  <ScrollBox v-else label="Behavior checks that each library passes">
    <table>
      <thead>
        <tr>
          <th scope="col">Group</th>
          <th v-for="column in columns" :key="column" scope="col">{{ columnName(column) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.group">
          <th scope="row">
            <a :href="`#${row.group}`">{{ row.title }}</a>
          </th>
          <td v-for="{ column, text, loss } in row.texts" :key="column">
            <strong>{{ text }}</strong
            ><BenchmarksNoteLink
              v-if="loss"
              :note="loss"
              :title="`${row.title}: a check that Vase UI does not pass`"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
</template>
