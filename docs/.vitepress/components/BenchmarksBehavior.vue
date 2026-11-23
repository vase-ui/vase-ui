<script setup lang="ts">
import type { BehaviorEngineResult, BehaviorRow } from '../../../scripts/docs/benchmarksReport.ts';
import { data } from '../../benchmarks.data.ts';
import {
  agree,
  behaviorVerdictName,
  columnName,
  engineName,
  failLines,
  libraryName,
  listOf,
  sameResults,
} from './benchmarksFormat.ts';
import BenchmarksNoteLink from './BenchmarksNoteLink.vue';
import { vaseUiFileAtCommitUrl } from './links.ts';
import ScrollBox from './ScrollBox.vue';
import TextWithCode from './TextWithCode.vue';

const props = defineProps<{
  /** The id of a group of `benchmarks/behavior/groups.ts`, such as `nested-dialogs`. */
  group: string;
}>();

const table = data.behaviorTables.find((item) => item.group === props.group);

/** The measures of the cases of one engine, such as `Chromium, Dialog: …`. */
function measureLines({ engine, cases }: BehaviorEngineResult): string[] {
  return cases.map(
    (item) =>
      `${engineName(engine)}${item.case === null ? '' : `, ${item.case}`}: ${item.measure || 'No measure.'}`,
  );
}

interface CellText {
  /** One verdict when the engines agree, else one for each set of engines. */
  results: { first: string; lines: string[] }[];
  measures: string[];
  /** The link text is the case, or `Fixture` for a check with one fixture. */
  fixtures: { name: string; label: string; url: string }[];
  loss?: string | undefined;
}

function textOf(row: BehaviorRow, column: string): CellText | string {
  const cell = row.cells[column];
  if (cell === undefined || cell === 'not-measured') {
    return 'Not measured yet';
  }
  if (cell === 'not-provided') {
    return 'Not provided';
  }
  const fact = row.kind === 'fact';
  const measuresOf = (engine: BehaviorEngineResult) =>
    engine.cases.map((item) => item.measure).join('\n');
  const groups = sameResults(
    cell.engines,
    fact ? (first, second) => measuresOf(first) === measuresOf(second) : agree,
  );
  const results = groups.map(({ names, verdict, cases }) => {
    const first = fact
      ? listOf([...new Set(cases.map((item) => item.measure))])
      : behaviorVerdictName(verdict);
    return {
      first: groups.length === 1 ? first : `${names}: ${first}`,
      lines: fact ? [] : failLines(cases),
    };
  });
  if (cell.notProvided.length > 0) {
    results.push({ first: '', lines: [`Not provided: ${listOf(cell.notProvided)}`] });
  }
  return {
    results,
    measures: fact ? [] : cell.engines.flatMap(measureLines),
    fixtures: cell.fixtures.map((fixture) => ({
      name: fixture.case ?? 'Fixture',
      label: `${fixture.case === null ? 'Fixture' : `${fixture.case} fixture`} of ${libraryName(column)}: ${row.title}`,
      url: vaseUiFileAtCommitUrl(data.commit, fixture.path),
    })),
    loss: cell.loss,
  };
}

const rows =
  table?.rows.map((row) => ({
    row,
    texts: table.columns.map((column) => ({ column, text: textOf(row, column) })),
  })) ?? [];
</script>

<template>
  <template v-if="table">
    <p v-for="(note, library) in table.notes" :key="library">
      {{ libraryName(library) }}: <TextWithCode :text="note ?? ''" />
    </p>
    <ScrollBox :label="table.title">
      <table>
        <thead>
          <tr>
            <th scope="col">Check</th>
            <th v-for="column in table.columns" :key="column" scope="col">
              {{ columnName(column) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="{ row, texts } in rows" :id="row.id" :key="row.key">
            <th scope="row">
              {{ row.title }}<br />
              <a :href="row.expectation.url" :aria-label="`Expectation: ${row.expectation.text}`"
                >Expectation</a
              >,
              <a
                :href="vaseUiFileAtCommitUrl(data.commit, table.code)"
                :aria-label="`Code of the check: ${row.title}`"
                >Code</a
              >
            </th>
            <td v-for="{ column, text } in texts" :key="column">
              <template v-if="typeof text === 'string'">{{ text }}</template>
              <template v-else>
                <div v-for="(result, index) in text.results" :key="index">
                  <strong v-if="result.first">{{ result.first }}</strong
                  ><BenchmarksNoteLink
                    v-if="text.loss && index === 0"
                    :note="text.loss"
                    :title="row.title"
                  /><template v-for="(line, lineIndex) in result.lines" :key="lineIndex"
                    ><br v-if="result.first || lineIndex > 0" />{{ line }}</template
                  >
                </div>
                <details v-if="text.measures.length > 0">
                  <summary>Measures</summary>
                  <template v-for="(line, index) in text.measures" :key="index"
                    ><br v-if="index > 0" />{{ line }}</template
                  >
                </details>
                <div>
                  <template v-if="text.fixtures.length > 1">Fixtures: </template
                  ><template v-for="(fixture, index) in text.fixtures" :key="fixture.url"
                    ><template v-if="index > 0">, </template
                    ><a :href="fixture.url" :aria-label="fixture.label">{{
                      fixture.name
                    }}</a></template
                  >
                </div>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </ScrollBox>
  </template>
  <p v-else>The group {{ group }} has no checks.</p>
</template>

<style scoped>
/* The box scrolls the columns of the libraries sideways. The names of the checks stay in view. */
thead th:first-child,
th[scope='row'] {
  position: sticky;
  inset-inline-start: 0;
}

/* A check has a long name, so its column keeps a width that the cells of the libraries do not
   squeeze. */
th[scope='row'] {
  min-width: min(12rem, 35vw);
}

details {
  margin: 0;
}

summary {
  cursor: pointer;
  white-space: nowrap;
}
</style>
