<script setup lang="ts">
import { data } from '../../benchmarks.data.ts';
import { engineName, setupName } from './benchmarksFormat.ts';
import { vaseUiCommitUrl } from './links.ts';
import ScrollBox from './ScrollBox.vue';

const TOOL_NAMES: Record<string, string> = {
  node: 'Node.js',
  zlib: 'zlib of Node.js',
  brotli: 'Brotli of Node.js',
  vite: 'Vite',
};
</script>

<template>
  <ScrollBox label="Run">
    <table>
      <thead>
        <tr>
          <th scope="col">Run</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Date (UTC)</th>
          <td>{{ data.date.slice(0, 10) }}</td>
        </tr>
        <tr>
          <th scope="row">Vase UI commit</th>
          <td>
            <a :href="vaseUiCommitUrl(data.commit)">
              <code>{{ data.commit.slice(0, 7) }}</code>
            </a>
          </td>
        </tr>
        <tr v-if="data.run">
          <th scope="row">Workflow run</th>
          <td>
            <a :href="data.run">{{ data.run.split('/').at(-1) }}</a>
          </td>
        </tr>
        <tr v-for="(version, tool) in data.tools" :key="tool">
          <th scope="row">{{ TOOL_NAMES[tool] ?? tool }}</th>
          <td>{{ version }}</td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
  <ScrollBox v-if="data.timeRuns.length > 0" label="Runs of the render time">
    <table>
      <thead>
        <tr>
          <th scope="col">Engine and setup</th>
          <th scope="col">Browser</th>
          <th scope="col">CPU slowdown</th>
          <th scope="col">Rounds</th>
          <th scope="col">Machine</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="run in data.timeRuns" :key="`${run.engine} ${run.setup}`">
          <th scope="row">{{ engineName(run.engine) }}, {{ setupName(run.setup) }}</th>
          <td>{{ run.browserVersion }}</td>
          <td>{{ run.cpuThrottle === null ? 'None' : `${String(run.cpuThrottle)} times` }}</td>
          <td>{{ run.rounds }}</td>
          <td>
            {{ run.machine.cpu }}, {{ run.machine.cores }} logical CPUs,
            {{ Math.round(run.machine.memory / 2 ** 30) }} GiB, {{ run.machine.os }}
          </td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
  <ScrollBox v-if="data.behaviorRuns.length > 0" label="Runs of the behavior checks">
    <table>
      <thead>
        <tr>
          <th scope="col">Engine</th>
          <th scope="col">Browser</th>
          <th scope="col">Runs of each case</th>
          <th scope="col">Machine</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="run in data.behaviorRuns" :key="run.engine">
          <th scope="row">{{ engineName(run.engine) }}</th>
          <td>{{ run.browserVersion }}</td>
          <td>{{ run.runs }}</td>
          <td>
            {{ run.machine.cpu }}, {{ run.machine.cores }} logical CPUs,
            {{ Math.round(run.machine.memory / 2 ** 30) }} GiB, {{ run.machine.os }}
          </td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
  <ScrollBox label="Versions">
    <table>
      <thead>
        <tr>
          <th scope="col">Library or framework</th>
          <th scope="col">Package</th>
          <th scope="col">Version</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="library in data.libraries" :key="library.id">
          <th scope="row">{{ library.name }}</th>
          <td>
            <code>{{ library.package }}</code>
          </td>
          <td>{{ library.id === 'vase-ui' ? 'The commit of the run' : library.version }}</td>
        </tr>
        <tr v-for="setup in data.setups" :key="setup.id">
          <th scope="row">{{ setup.name }}</th>
          <td>
            <code>{{ setup.package }}</code>
          </td>
          <td>{{ setup.version }}</td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
</template>
