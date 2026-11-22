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

const PERCENT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const parts = data.sizeTables.map((table) => ({
  setup: table.setup,
  sizeLosses: data.sizeLosses.filter((loss) => loss.setup === table.setup),
  timeLosses: data.timeLosses.filter((loss) => loss.setup === table.setup),
  timed: data.timeRuns.some((run) => run.setup === table.setup),
}));
</script>

<template>
  <template v-for="part in parts" :key="part.setup">
    <h3>{{ setupName(part.setup) }}</h3>
    <p v-if="part.sizeLosses.length === 0">
      In each measured row, each other library adds as many gzip bytes as Vase UI, or more.
    </p>
    <ScrollBox v-else :label="`Where Vase UI is larger: ${setupName(part.setup)}`">
      <table>
        <thead>
          <tr>
            <th scope="col">App</th>
            <th scope="col">Library</th>
            <th scope="col">Library adds (gzip bytes)</th>
            <th scope="col">Vase UI adds (gzip bytes)</th>
            <th scope="col">Vase UI adds more</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="loss in part.sizeLosses" :key="`${loss.label} ${loss.library}`">
            <th scope="row">{{ loss.label }}</th>
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
    <p v-if="!part.timed">The render times of this setup are not measured yet.</p>
    <p v-else-if="part.timeLosses.length === 0">
      In each measured row, no other library is faster than Vase UI or uses less memory, by the rule
      of <a href="#how-to-read-the-numbers">How to read the numbers</a>.
    </p>
    <ScrollBox
      v-else
      :label="`Where Vase UI is slower or uses more memory: ${setupName(part.setup)}`"
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">Library</th>
            <th scope="col">Library median</th>
            <th scope="col">Vase UI median</th>
            <th scope="col">Ratio to Vase UI</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="loss in part.timeLosses" :key="`${loss.engine} ${loss.label} ${loss.library}`">
            <th scope="row">{{ engineName(loss.engine) }}, {{ loss.label }}</th>
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
