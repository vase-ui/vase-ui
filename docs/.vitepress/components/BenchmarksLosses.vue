<script setup lang="ts">
import { data } from '../../benchmarks.data.ts';
import { formatBytes } from './benchmarksFormat.ts';
import ScrollBox from './ScrollBox.vue';

const PERCENT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function nameOf(id: string): string {
  return data.libraries.find((library) => library.id === id)?.name ?? id;
}

function setupName(setup: string): string {
  return data.setups.find((item) => item.id === setup)?.name ?? setup;
}

const parts = data.sizeTables.map((table) => ({
  setup: table.setup,
  losses: data.sizeLosses.filter((loss) => loss.setup === table.setup),
}));
</script>

<template>
  <template v-for="part in parts" :key="part.setup">
    <h3>{{ setupName(part.setup) }}</h3>
    <p v-if="part.losses.length === 0">
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
          <tr v-for="loss in part.losses" :key="`${loss.label} ${loss.library}`">
            <th scope="row">{{ loss.label }}</th>
            <td>{{ nameOf(loss.library) }}</td>
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
  </template>
</template>
