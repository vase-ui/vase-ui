<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';
import type { ApiReference } from '../../../scripts/docs/apiReference.ts';
import TextWithCode from './TextWithCode.vue';

// `transformPageData` in the site configuration adds `apiReference`.
// The type of the page data lacks that key.
const { page } = useData();
const parts = computed(() => {
  const reference = (page.value as { apiReference?: ApiReference }).apiReference;
  if (!reference) {
    throw new Error(
      `${page.value.relativePath} has no API reference. Put <ApiReference /> only on a family page, such as docs/components/button.md.`,
    );
  }
  return reference.parts;
});

const MEMBER_TABLES = [
  { key: 'events', title: 'Events', columns: ['Event', 'Arguments', 'Description'] },
  { key: 'exposed', title: 'Exposed', columns: ['Member', 'Type', 'Description'] },
  {
    key: 'dataAttributes',
    title: 'Data attributes',
    columns: ['Attribute', 'Type', 'Description'],
  },
  { key: 'cssVariables', title: 'CSS variables', columns: ['Variable', 'Type', 'Description'] },
] as const;

function idOf(name: string): string {
  return name.toLowerCase().replaceAll('.', '-');
}
</script>

<template>
  <section v-for="part in parts" :key="part.name">
    <h3 :id="idOf(part.name)">{{ part.name }}</h3>
    <p v-if="part.description"><TextWithCode :text="part.description" /></p>
    <p v-if="part.hasChildren">
      The part has nodes of its own, so a <code>#render</code> slot must mount the
      <code>children</code> slot prop in its element.
    </p>
    <template v-if="part.props.length > 0">
      <h4>Props</h4>
      <table>
        <thead>
          <tr>
            <th scope="col">Prop</th>
            <th scope="col">Type</th>
            <th scope="col">Default</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="prop in part.props" :key="prop.name">
            <td>
              <code>{{ prop.name }}</code>
            </td>
            <td>
              <code>{{ prop.type }}</code>
            </td>
            <td>
              <template v-if="prop.required">Required</template>
              <code v-else-if="prop.default !== null">{{ prop.default }}</code>
            </td>
            <td><TextWithCode :text="prop.description" /></td>
          </tr>
        </tbody>
      </table>
    </template>
    <template v-if="part.slots.length > 0">
      <h4>Slots</h4>
      <table>
        <thead>
          <tr>
            <th scope="col">Slot</th>
            <th scope="col">Slot props</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="slot in part.slots" :key="slot.name">
            <td>
              <code>{{ slot.name }}</code>
            </td>
            <td>
              <div v-for="slotProp in slot.props" :key="slotProp.name">
                <code>{{ slotProp.name }}: {{ slotProp.type }}</code>
              </div>
            </td>
            <td><TextWithCode :text="slot.description" /></td>
          </tr>
        </tbody>
      </table>
    </template>
    <template v-for="table in MEMBER_TABLES" :key="table.key">
      <template v-if="part[table.key].length > 0">
        <h4>{{ table.title }}</h4>
        <table>
          <thead>
            <tr>
              <th v-for="column in table.columns" :key="column" scope="col">{{ column }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in part[table.key]" :key="row.name">
              <td>
                <code>{{ row.name }}</code>
              </td>
              <td>
                <code v-if="row.type">{{ row.type }}</code>
              </td>
              <td><TextWithCode :text="row.description" /></td>
            </tr>
          </tbody>
        </table>
      </template>
    </template>
  </section>
</template>
