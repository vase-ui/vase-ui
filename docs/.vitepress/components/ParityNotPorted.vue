<script setup lang="ts">
import { data } from '../../parity.data.ts';
import ScrollBox from './ScrollBox.vue';
import TextWithCode from './TextWithCode.vue';
</script>

<template>
  <ScrollBox label="Not ported">
    <table>
      <thead>
        <tr>
          <th scope="col">What</th>
          <th scope="col">Reason</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in data.notPorted" :key="item.what">
          <td><TextWithCode :text="item.what" /></td>
          <td><TextWithCode :text="item.reason" /></td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
</template>
