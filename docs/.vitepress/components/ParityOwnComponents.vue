<script setup lang="ts">
import { data } from '../../parity.data.ts';
import ScrollBox from './ScrollBox.vue';
import TextWithCode from './TextWithCode.vue';
</script>

<template>
  <p v-if="data.ownComponents.length === 0">None yet.</p>
  <ScrollBox v-else label="Components of Vase UI's own">
    <table>
      <thead>
        <tr>
          <th scope="col">Component</th>
          <th scope="col">Reason</th>
          <th scope="col">Standard</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in data.ownComponents" :key="item.name">
          <td>{{ item.name }}</td>
          <td><TextWithCode :text="item.reason" /></td>
          <td>
            <ul>
              <li v-for="link in item.standard" :key="link">
                <a :href="link">{{ link }}</a>
              </li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
</template>
