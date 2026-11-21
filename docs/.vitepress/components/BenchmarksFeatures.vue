<script setup lang="ts">
import type { FeatureRow } from '../../../scripts/docs/benchmarksReport.ts';
import { data } from '../../benchmarks.data.ts';
import ScrollBox from './ScrollBox.vue';
import TextWithCode from './TextWithCode.vue';

const SUPPORT_TEXT: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  partial: 'Partly',
  'not-applicable': 'Not applicable',
};

function valueText(row: FeatureRow, value: string): string {
  return row.kind === 'support' ? (SUPPORT_TEXT[value] ?? value) : value;
}
</script>

<template>
  <ScrollBox label="Features">
    <table>
      <thead>
        <tr>
          <th scope="col">Feature</th>
          <th v-for="library in data.libraries" :key="library.id" scope="col">
            {{ library.name }}
          </th>
        </tr>
      </thead>
      <tbody v-for="group in data.features.groups" :key="group.name">
        <tr>
          <th scope="rowgroup" :colspan="data.libraries.length + 1">
            <span class="group-name">{{ group.name }}</span>
          </th>
        </tr>
        <tr v-for="row in group.rows" :key="row.feature">
          <th scope="row">{{ row.feature }}</th>
          <td v-for="library in data.libraries" :key="library.id">
            <strong>{{ valueText(row, row.cells[library.id].value) }}</strong
            ><br />
            <template v-if="row.cells[library.id].note">
              <TextWithCode :text="row.cells[library.id].note ?? ''" /><br />
            </template>
            <a
              :href="row.cells[library.id].source"
              :aria-label="`Source of ${library.name}: ${row.feature}`"
              >Source</a
            >
          </td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
</template>

<style scoped>
/* The box scrolls the columns of the libraries sideways. The names of the features and of the groups
   stay in view. */
thead th:first-child,
th[scope='row'] {
  position: sticky;
  inset-inline-start: 0;
}

/* A group name sticks inside its wide cell, at the padding of the cell. */
.group-name {
  display: inline-block;
  position: sticky;
  inset-inline-start: 0.75rem;
}
</style>
