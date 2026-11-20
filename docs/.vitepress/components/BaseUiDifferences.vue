<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';
import type { BaseUiDifferences } from '../../../scripts/docs/baseUiDifferences.ts';
import { DIFFERENCES_SECTIONS, HANDBOOK_DIFFERENCES } from './baseUiDifferencesSections.ts';
import ScrollBox from './ScrollBox.vue';
import TextWithCode from './TextWithCode.vue';

// `transformPageData` in the site configuration adds `baseUiDifferences`.
// The type of the page data lacks that key.
const { page } = useData();
const differences = computed(() => {
  const found = (page.value as { baseUiDifferences?: BaseUiDifferences }).baseUiDifferences;
  if (!found) {
    throw new Error(
      `${page.value.relativePath} has no differences from Base UI. Put <BaseUiDifferences /> only on a family page, such as docs/components/collapsible.md.`,
    );
  }
  return found;
});
const hasRows = computed(() =>
  DIFFERENCES_SECTIONS.some(({ key }) => differences.value[key].length > 0),
);

const MEMBER_KIND_WORDS = {
  prop: 'prop',
  emit: 'event',
  slot: 'slot',
  exposed: 'exposed member',
  changeEventReason: 'change reason',
  stateField: 'state field',
  constant: 'constant',
} as const;
</script>

<template>
  <p v-if="differences.release !== null">
    Vase UI ports {{ page.title }} from Base UI {{ differences.release }}.
  </p>
  <template v-if="differences.own">
    <p>Base UI has no {{ page.title }}. <TextWithCode :text="differences.own.reason" /></p>
    <ul>
      <li v-for="link in differences.own.standard" :key="link">
        <a :href="link">{{ link }}</a>
      </li>
    </ul>
  </template>
  <p v-else-if="!hasRows">{{ page.title }} has no difference of its own.</p>
  <template v-for="section in DIFFERENCES_SECTIONS" :key="section.key">
    <template v-if="differences[section.key].length > 0">
      <h3 :id="section.id" tabindex="-1">
        {{ section.title }}
        <a
          class="header-anchor"
          :href="`#${section.id}`"
          :aria-label="`Permalink to “${section.title}”`"
          >&#8203;</a
        >
      </h3>
      <ScrollBox class="api-table" :label="`${section.title}: differences from Base UI`">
        <table>
          <thead>
            <tr>
              <th v-for="column in section.columns" :key="column" scope="col">{{ column }}</th>
            </tr>
          </thead>
          <tbody v-if="section.key === 'api'">
            <tr v-for="(row, index) in differences.api" :key="index">
              <td>
                <code>{{ row.baseUi }}</code>
                <template v-if="row.prop !== null">
                  prop <code>{{ row.prop }}</code></template
                >
              </td>
              <td><TextWithCode :text="row.vaseUi" /></td>
            </tr>
          </tbody>
          <tbody v-else-if="section.key === 'added'">
            <tr v-for="row in differences.added" :key="`${row.part} ${row.kind} ${row.member}`">
              <td>
                <code>{{ row.part }}</code>
              </td>
              <td>
                <code>{{ row.member }}</code> {{ MEMBER_KIND_WORDS[row.kind] }}
              </td>
              <td><TextWithCode :text="row.why" /></td>
            </tr>
          </tbody>
          <tbody v-else-if="section.key === 'returnTypes'">
            <tr v-for="row in differences.returnTypes" :key="row.name">
              <td>
                <code>{{ row.name }}</code>
              </td>
              <td>
                <code>{{ row.returns }}</code>
              </td>
              <td><TextWithCode :text="row.why" /></td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr v-for="row in differences.behavior" :key="row.id">
              <td><TextWithCode :text="row.behavior" /></td>
              <td>
                <ul>
                  <li v-for="link in row.evidence" :key="link">
                    <a :href="link">{{ link }}</a>
                  </li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </ScrollBox>
    </template>
  </template>
  <p>
    The handbook gives the differences that all components share:
    <template v-for="(link, index) in HANDBOOK_DIFFERENCES" :key="link.href">
      <a :href="link.href">{{ link.title }}</a
      >{{
        index === HANDBOOK_DIFFERENCES.length - 1
          ? '.'
          : index === HANDBOOK_DIFFERENCES.length - 2
            ? ' and '
            : ', '
      }}
    </template>
  </p>
</template>
