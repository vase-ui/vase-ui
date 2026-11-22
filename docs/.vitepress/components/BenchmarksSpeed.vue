<script setup lang="ts">
import { data } from '../../benchmarks.data.ts';
import { engineName, formatRatio, libraryName } from './benchmarksFormat.ts';
import ScrollBox from './ScrollBox.vue';

const libraries = [
  ...new Set(data.speed.flatMap((engine) => engine.libraries.map((speed) => speed.library))),
];
const rows = data.speed.map((engine) => ({
  engine: engine.engine,
  cells: libraries.map((library) => ({
    library,
    speed: engine.libraries.find((speed) => speed.library === library),
  })),
}));
</script>

<template>
  <p v-if="rows.length === 0">The render times are not measured yet.</p>
  <ScrollBox v-else label="Time of each Vue library over the time of Vase UI">
    <table>
      <thead>
        <tr>
          <th scope="col">Engine</th>
          <th v-for="library in libraries" :key="library" scope="col">
            {{ libraryName(library) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.engine">
          <th scope="row">{{ engineName(row.engine) }}</th>
          <td v-for="{ library, speed } in row.cells" :key="library">
            <template v-if="speed">
              <strong>{{ formatRatio(speed.ratio) }}</strong
              ><br />Vase UI faster in {{ speed.faster }} of {{ speed.metrics }}
            </template>
            <template v-else>Not measured yet</template>
          </td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
</template>
