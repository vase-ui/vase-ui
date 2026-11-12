<script setup lang="ts">
import { data } from '../../parity.data.ts';
import { baseUiCommitUrl } from './links.ts';
</script>

<template>
  <p>{{ data.status.line }}</p>
  <p v-if="data.status.notStarted.length > 0">
    Not started ({{ data.status.notStarted.length }}): {{ data.status.notStarted.join(', ') }}
  </p>
  <table>
    <thead>
      <tr>
        <th scope="col">Tracked commit</th>
        <th scope="col">Described as</th>
        <th scope="col">Date</th>
        <th scope="col">Release</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <a :href="baseUiCommitUrl(data.upstream.commit)">
            <code>{{ data.upstream.commit.slice(0, 7) }}</code>
          </a>
        </td>
        <td>{{ data.upstream.describe }}</td>
        <td>{{ data.upstream.date }}</td>
        <td>{{ data.upstream.release }}</td>
      </tr>
    </tbody>
  </table>
  <table>
    <thead>
      <tr>
        <th scope="col">Family</th>
        <th scope="col">Component</th>
        <th scope="col">Matched commit</th>
        <th scope="col">Sources ported</th>
        <th scope="col">Cases matched</th>
        <th scope="col">Queued changes</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="family in data.families" :key="family.name">
        <td>{{ family.name }}</td>
        <td>{{ family.isComponent ? 'Yes' : 'No' }}</td>
        <td>
          <a :href="baseUiCommitUrl(family.matchedCommit.sha)">
            <code>{{ family.matchedCommit.sha.slice(0, 7) }}</code>
          </a>
          {{ family.matchedCommit.date }}
        </td>
        <td>{{ family.sources.ported }} of {{ family.sources.total }}</td>
        <td>{{ family.cases.matched }} of {{ family.cases.total }}</td>
        <td>{{ family.queued.count }}</td>
      </tr>
    </tbody>
  </table>
</template>
