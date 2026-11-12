<script setup lang="ts">
import { data } from '../../parity.data.ts';
import { baseUiCommitUrl, vaseUiFileUrl } from './links.ts';
import TextWithCode from './TextWithCode.vue';

type Family = (typeof data.families)[number];

function fileRows(family: Family) {
  return [
    { label: 'Sources', tally: family.sources },
    { label: 'Type tests', tally: family.typeTests },
  ];
}

function caseRows(family: Family) {
  return [
    { label: 'Cases', tally: family.cases },
    { label: 'Suite calls', tally: family.suiteCalls },
  ];
}

function surfaceRows({ surface }: Family) {
  return surface
    ? [
        { label: 'Entries', tally: surface.entries },
        { label: 'Prop rows', tally: surface.propRows },
      ]
    : [];
}
</script>

<template>
  <section v-for="family in data.families" :key="family.name">
    <h3 :id="family.name">{{ family.name }}</h3>
    <p>
      Matches the Base UI commit
      <a :href="baseUiCommitUrl(family.matchedCommit.sha)">
        <code>{{ family.matchedCommit.sha.slice(0, 7) }}</code>
      </a>
      of {{ family.matchedCommit.date }}.
    </p>
    <p>
      Queued changes: {{ family.queued.count }}.
      <template v-if="family.queued.oldest">
        The oldest is from {{ family.queued.oldest }}.
      </template>
    </p>
    <p>Vase UI rows with no upstream row: {{ family.rowsWithoutUpstream }}.</p>
    <table>
      <thead>
        <tr>
          <th scope="col">Files</th>
          <th scope="col">Total</th>
          <th scope="col">Ported</th>
          <th scope="col">Replaced</th>
          <th scope="col">Not applicable</th>
          <th scope="col">Waits on</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in fileRows(family)" :key="row.label">
          <td>{{ row.label }}</td>
          <td>{{ row.tally.total }}</td>
          <td>{{ row.tally.ported }}</td>
          <td>{{ row.tally.replaced }}</td>
          <td>{{ row.tally['not-applicable'] }}</td>
          <td>{{ row.tally['waits-on'] }}</td>
        </tr>
      </tbody>
    </table>
    <table>
      <thead>
        <tr>
          <th scope="col">Tests</th>
          <th scope="col">Total</th>
          <th scope="col">Matched</th>
          <th scope="col">Replaced</th>
          <th scope="col">Not applicable</th>
          <th scope="col">Waits on</th>
          <th scope="col">Engine Chromium</th>
          <th scope="col">Engine Firefox</th>
          <th scope="col">Engine WebKit</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in caseRows(family)" :key="row.label">
          <td>{{ row.label }}</td>
          <td>{{ row.tally.total }}</td>
          <td>{{ row.tally.matched }}</td>
          <td>{{ row.tally.replaced }}</td>
          <td>{{ row.tally['not-applicable'] }}</td>
          <td>{{ row.tally['waits-on'] }}</td>
          <td>{{ row.tally.engine.chromium }}</td>
          <td>{{ row.tally.engine.firefox }}</td>
          <td>{{ row.tally.engine.webkit }}</td>
        </tr>
      </tbody>
    </table>
    <table v-if="family.surface">
      <thead>
        <tr>
          <th scope="col">API</th>
          <th scope="col">Total</th>
          <th scope="col">Matched</th>
          <th scope="col">Excepted</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in surfaceRows(family)" :key="row.label">
          <td>{{ row.label }}</td>
          <td>{{ row.tally.total }}</td>
          <td>{{ row.tally.matched }}</td>
          <td>{{ row.tally.excepted }}</td>
        </tr>
      </tbody>
    </table>
    <p>Exception rows: {{ family.exceptions.length }}.</p>
    <table v-if="family.exceptions.length > 0">
      <thead>
        <tr>
          <th scope="col">Thing</th>
          <th scope="col">Kind</th>
          <th scope="col">Reason</th>
          <th scope="col">Detail</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in family.exceptions" :key="index">
          <td>{{ row.thing }}</td>
          <td>
            <code>{{ row.kind }}</code>
          </td>
          <td><TextWithCode :text="row.reason" /></td>
          <td>
            <template v-if="row.test">
              Test: <a :href="vaseUiFileUrl(row.test)">{{ row.test }}</a>
            </template>
            <template v-else-if="row.engine">
              Engine: <a :href="row.link">{{ row.engine }}</a>
            </template>
            <template v-else-if="row.waitsOn">Waits on: {{ row.waitsOn }}</template>
          </td>
        </tr>
      </tbody>
    </table>
    <p>Additions to the Base UI API: {{ family.surfaceAdditions.length }}.</p>
    <table v-if="family.surfaceAdditions.length > 0">
      <thead>
        <tr>
          <th scope="col">Entry</th>
          <th scope="col">Kind</th>
          <th scope="col">Name</th>
          <th scope="col">Reason</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="addition in family.surfaceAdditions"
          :key="`${addition.entry} ${addition.kind} ${addition.name}`"
        >
          <td>{{ addition.entry }}</td>
          <td>{{ addition.kind }}</td>
          <td>
            <code>{{ addition.name }}</code>
          </td>
          <td><TextWithCode :text="addition.reason" /></td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
