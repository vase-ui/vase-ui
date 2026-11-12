<script setup lang="ts">
import { data } from '../../parity.data.ts';
import { vaseUiFileUrl } from './links.ts';
import TextWithCode from './TextWithCode.vue';
</script>

<template>
  <table>
    <thead>
      <tr>
        <th scope="col">ID</th>
        <th scope="col">Behavior</th>
        <th scope="col">Evidence</th>
        <th scope="col">Due with</th>
        <th scope="col">Tests</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="edgeCase in data.edgeCases" :key="edgeCase.id">
        <td>{{ edgeCase.id }}</td>
        <td><TextWithCode :text="edgeCase.behavior" /></td>
        <td>
          <ul>
            <li v-for="link in edgeCase.evidence" :key="link">
              <a :href="link">{{ link }}</a>
            </li>
          </ul>
        </td>
        <td>
          <code>{{ edgeCase.dueWith }}</code>
        </td>
        <td>
          <template v-if="!edgeCase.due">Not due</template>
          <ul v-else>
            <li v-for="test in edgeCase.tests" :key="`${test.file} ${test.title}`">
              <a :href="vaseUiFileUrl(test.file)">{{ test.file }}</a
              >: {{ test.title }}
            </li>
          </ul>
        </td>
      </tr>
    </tbody>
  </table>
</template>
