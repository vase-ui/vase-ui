<script setup lang="ts">
import { data } from '../../parity.data.ts';
import { baseUiCommitUrl } from './links.ts';
import TextWithCode from './TextWithCode.vue';

function wordsOf(state: string): string {
  return state.replaceAll('-', ' ');
}
</script>

<template>
  <table>
    <thead>
      <tr>
        <th scope="col">Date</th>
        <th scope="col">Change</th>
        <th scope="col">Commit</th>
        <th scope="col">State</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="change in data.changes" :key="change.sha">
        <td>{{ change.date }}</td>
        <td>{{ change.subject }}</td>
        <td>
          <a :href="baseUiCommitUrl(change.sha)">
            <code>{{ change.sha.slice(0, 7) }}</code>
          </a>
        </td>
        <td>
          <ul v-if="change.families.length > 0">
            <li v-for="family in change.families" :key="family.name">
              {{ family.name }}: {{ wordsOf(family.state) }}.
              <TextWithCode v-if="family.reason" :text="family.reason" />
            </li>
          </ul>
          <template v-else-if="change.other">
            {{ wordsOf(change.other.state) }}.
            <ul v-if="change.other.state === 'out-of-scope' && change.other.reasons.length > 0">
              <li v-for="reason in change.other.reasons" :key="reason">
                <TextWithCode :text="reason" />
              </li>
            </ul>
          </template>
        </td>
      </tr>
    </tbody>
  </table>
</template>
