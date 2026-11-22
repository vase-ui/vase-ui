<script setup lang="ts">
import { data } from '../../benchmarks.data.ts';
import {
  engineName,
  formatBytes,
  formatInterval,
  formatMeasure,
  formatRatio,
  libraryName,
  setupName,
} from './benchmarksFormat.ts';
import ScrollBox from './ScrollBox.vue';
import TextWithCode from './TextWithCode.vue';

const PERCENT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

// The `*` of a size cell links to its note also when the row loses only in raw or Brotli bytes, so
// the note shows with no row below it.
const sizeNotes = new Set(
  data.sizeTables.flatMap((table) => table.rows.flatMap((row) => Object.values(row.notes))),
);

/** The losses of each note, in the sequence of `notes.json`. */
const groups = data.notes
  .map((note) => ({
    ...note,
    sizeLosses: data.sizeLosses.filter((loss) => loss.note === note.id),
    timeLosses: data.timeLosses.filter((loss) => loss.note === note.id),
  }))
  .filter((group) => sizeNotes.has(group.id) || group.timeLosses.length > 0);
</script>

<template>
  <p v-if="groups.length === 0">
    In each measured row, each other Vue library is as large as Vase UI or larger, and no other Vue
    library is faster or uses less memory.
  </p>
  <template v-for="group in groups" :key="group.id">
    <h3 :id="group.id" tabindex="-1">
      {{ group.title }}
      <a class="header-anchor" :href="`#${group.id}`" :aria-label="`Permalink to “${group.title}”`"
        >&#8203;</a
      >
    </h3>
    <p><TextWithCode :text="group.reason" /></p>
    <p v-if="group.sources.length > 0">
      Sources:
      <template v-for="(source, index) in group.sources" :key="source.url"
        >{{ index === 0 ? '' : ', ' }}<a :href="source.url">{{ source.name }}</a></template
      >.
    </p>
    <ScrollBox v-if="group.sizeLosses.length > 0" :label="`${group.title}: size`">
      <table>
        <thead>
          <tr>
            <th scope="col">Setup and app</th>
            <th scope="col">Library</th>
            <th scope="col">Library adds (gzip bytes)</th>
            <th scope="col">Vase UI adds (gzip bytes)</th>
            <th scope="col">Vase UI adds more</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="loss in group.sizeLosses" :key="`${loss.setup} ${loss.label} ${loss.library}`">
            <th scope="row">{{ setupName(loss.setup) }}, {{ loss.label }}</th>
            <td>{{ libraryName(loss.library) }}</td>
            <td>{{ formatBytes(loss.libraryBytes) }}</td>
            <td>{{ formatBytes(loss.vaseBytes) }}</td>
            <td>
              {{ formatBytes(loss.vaseBytes - loss.libraryBytes) }} bytes ({{
                PERCENT.format(((loss.vaseBytes - loss.libraryBytes) / loss.libraryBytes) * 100)
              }}%)
            </td>
          </tr>
        </tbody>
      </table>
    </ScrollBox>
    <ScrollBox v-if="group.timeLosses.length > 0" :label="`${group.title}: time and memory`">
      <table>
        <thead>
          <tr>
            <th scope="col">Engine, setup and measure</th>
            <th scope="col">Library</th>
            <th scope="col">Library median</th>
            <th scope="col">Vase UI median</th>
            <th scope="col">Ratio to Vase UI</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="loss in group.timeLosses"
            :key="`${loss.engine} ${loss.setup} ${loss.label} ${loss.library}`"
          >
            <th scope="row">
              {{ engineName(loss.engine) }}, {{ setupName(loss.setup) }}, {{ loss.label }}
            </th>
            <td>{{ libraryName(loss.library) }}</td>
            <td>{{ formatMeasure(loss.libraryMedian, loss.unit) }}</td>
            <td>{{ formatMeasure(loss.vaseMedian, loss.unit) }}</td>
            <td>
              {{ formatRatio(loss.comparison.ratio) }} ({{
                formatInterval(loss.comparison.interval)
              }})
            </td>
          </tr>
        </tbody>
      </table>
    </ScrollBox>
  </template>
</template>
