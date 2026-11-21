<script setup lang="ts">
import { data } from '../../parity.data.ts';
import { baseUiCommitUrl } from './links.ts';
import ScrollBox from './ScrollBox.vue';
</script>

<template>
  <p>Vase UI has {{ data.status.done }} of the {{ data.status.total }} components of Base UI.</p>
  <p v-if="data.status.notStarted.length > 0">
    Not started ({{ data.status.notStarted.length }}): {{ data.status.notStarted.join(', ') }}
  </p>
  <ScrollBox label="Tracked Base UI commit">
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
  </ScrollBox>
  <p>The table below counts the test cases of Base UI in each family:</p>
  <ul>
    <li>
      Base UI cases: the cases of the Base UI test files of the family. A case that is not covered
      and not applicable waits for a Base UI file that Vase UI does not have yet.
    </li>
    <li>
      Covered: a Vase UI test runs the case. The test is the ported case, or the Vase UI test that
      the family names for the case.
    </li>
    <li>
      Not applicable: the case is for a thing that Vue or the browser gives in another form, or for
      a thing that only React has. The section of each family gives the reasons. The column Family
      has the links.
    </li>
    <li>
      Vase UI tests: the test cases of the Vase UI files that cover the Base UI cases of the family.
      A file that covers the cases of more than one family counts in each of these families.
    </li>
  </ul>
  <ScrollBox label="Families">
    <table>
      <thead>
        <tr>
          <th scope="col">Family</th>
          <th scope="col">Component</th>
          <th scope="col">Matched commit</th>
          <th scope="col">Base UI cases</th>
          <th scope="col">Covered</th>
          <th scope="col">Not applicable</th>
          <th scope="col">Vase UI tests</th>
          <th scope="col">Queued changes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="family in data.families" :key="family.name">
          <td>
            <a :href="`#${family.name}`">{{ family.name }}</a>
          </td>
          <td>{{ family.isComponent ? 'Yes' : 'No' }}</td>
          <td>
            <a :href="baseUiCommitUrl(family.matchedCommit.sha)">
              <code>{{ family.matchedCommit.sha.slice(0, 7) }}</code>
            </a>
            {{ family.matchedCommit.date }}
          </td>
          <td>{{ family.cases.total }}</td>
          <td>{{ family.coveredCases }}</td>
          <td>{{ family.cases['not-applicable'] }}</td>
          <td>{{ family.vaseTests }}</td>
          <td>{{ family.queued.count }}</td>
        </tr>
      </tbody>
    </table>
  </ScrollBox>
</template>
