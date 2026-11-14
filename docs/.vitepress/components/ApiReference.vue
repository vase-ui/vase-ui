<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';
import type { ApiReference, ApiClass } from '../../../scripts/docs/apiReference.ts';
import TextWithCode from './TextWithCode.vue';

const props = defineProps<{
  /**
   * The name of one function, class or type of the reference, such as `mergeProps`. The page
   * writes the heading and the text. With no name, the component shows each part of the family.
   */
  name?: string;
}>();

// `transformPageData` in the site configuration adds `apiReference`.
// The type of the page data lacks that key.
const { page } = useData();
const reference = computed(() => {
  const found = (page.value as { apiReference?: ApiReference }).apiReference;
  if (!found) {
    throw new Error(
      `${page.value.relativePath} has no API reference. Put <ApiReference /> only on a family page, such as docs/components/button.md.`,
    );
  }
  return found;
});
const parts = computed(() => (props.name === undefined ? reference.value.parts : []));
const named = computed(() => {
  const { name } = props;
  if (name === undefined) {
    return undefined;
  }
  const { functions, classes, types } = reference.value;
  const apiFunction = functions.find((item) => item.name === name);
  const apiClass = classes.find((item) => item.name === name);
  const apiType = types.find((item) => item.name === name);
  if (!apiFunction && !apiClass && !apiType) {
    const names = [...functions, ...classes, ...types].map((item) => item.name).join(', ');
    throw new Error(
      `${page.value.relativePath} has <ApiReference name="${name}" />, but the API reference of its family has no function, class or type with that name, so the page shows nothing. Use one of these names: ${names}.`,
    );
  }
  return { apiFunction, apiClass, apiType };
});
const showsDefault = computed(
  () => named.value?.apiType?.properties.some((property) => property.default !== null) ?? false,
);

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

/** `open(triggerId: string)`. */
function signatureOf({ name, parameters }: ApiClass['methods'][number]): string {
  const list = parameters.map(
    (parameter) => `${parameter.name}${parameter.optional ? '?' : ''}: ${parameter.type}`,
  );
  return `${name}(${list.join(', ')})`;
}

// The prefix makes the id different from the slug of a Markdown heading, such as the page title.
function idOf(name: string): string {
  return `api-${name.toLowerCase().replaceAll('.', '-')}`;
}
</script>

<template>
  <template v-if="named?.apiFunction">
    <template v-if="named.apiFunction.parameters.length > 0">
      <h4>Parameters</h4>
      <div class="api-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Parameter</th>
              <th scope="col">Type</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="parameter in named.apiFunction.parameters" :key="parameter.name">
              <td>
                <code>{{ parameter.optional ? `${parameter.name}?` : parameter.name }}</code>
              </td>
              <td>
                <code>{{ parameter.type }}</code>
              </td>
              <td><TextWithCode :text="parameter.description" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <h4>Return value</h4>
    <p v-if="named.apiFunction.returns.description">
      <TextWithCode :text="named.apiFunction.returns.description" />
    </p>
    <p>
      <code>{{ named.apiFunction.returns.type }}</code>
    </p>
  </template>
  <template v-else-if="named?.apiClass">
    <template v-if="named.apiClass.properties.length > 0">
      <h4>Properties</h4>
      <div class="api-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Property</th>
              <th scope="col">Type</th>
              <th scope="col">Modifiers</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="property in named.apiClass.properties" :key="property.name">
              <td>
                <code>{{ property.name }}</code>
              </td>
              <td>
                <code>{{ property.type }}</code>
              </td>
              <td>
                <code v-if="property.readonly">readonly</code>
              </td>
              <td><TextWithCode :text="property.description" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <template v-if="named.apiClass.methods.length > 0">
      <h4>Methods</h4>
      <div class="api-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Method</th>
              <th scope="col">Returns</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="method in named.apiClass.methods" :key="method.name">
              <td>
                <code>{{ signatureOf(method) }}</code>
              </td>
              <td>
                <code>{{ method.returns.type }}</code>
                <div v-if="method.returns.description">
                  <TextWithCode :text="method.returns.description" />
                </div>
              </td>
              <td>
                <TextWithCode :text="method.description" />
                <template v-for="parameter in method.parameters" :key="parameter.name">
                  <div v-if="parameter.description">
                    <code>{{ parameter.name }}</code
                    >: <TextWithCode :text="parameter.description" />
                  </div>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </template>
  <div v-else-if="named?.apiType && named.apiType.properties.length > 0" class="api-table">
    <table>
      <thead>
        <tr>
          <th scope="col">Property</th>
          <th scope="col">Type</th>
          <th v-if="showsDefault" scope="col">Default</th>
          <th scope="col">Description</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="property in named.apiType.properties" :key="property.name">
          <td>
            <code>{{ property.optional ? `${property.name}?` : property.name }}</code>
          </td>
          <td>
            <code>{{ property.type }}</code>
          </td>
          <td v-if="showsDefault">
            <code v-if="property.default !== null">{{ property.default }}</code>
          </td>
          <td><TextWithCode :text="property.description" /></td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-else-if="named?.apiType">
    <code>{{ named.apiType.values.map((value) => `'${value}'`).join(' | ') }}</code>
  </p>
  <section v-for="part in parts" :key="part.name">
    <h3 :id="idOf(part.name)" tabindex="-1">
      {{ part.name }}
      <a
        class="header-anchor"
        :href="`#${idOf(part.name)}`"
        :aria-label="`Permalink to “${part.name}”`"
        >&#8203;</a
      >
    </h3>
    <p v-if="part.description"><TextWithCode :text="part.description" /></p>
    <p v-if="part.hasChildren">
      A <code>#render</code> slot must mount the <code>children</code> slot prop in its element,
      with the content in it. <code>children</code> adds the nodes of the part itself, where the
      part has such nodes.
    </p>
    <template v-if="part.props.length > 0">
      <h4>Props</h4>
      <div class="api-table">
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
      </div>
    </template>
    <template v-if="part.slots.length > 0">
      <h4>Slots</h4>
      <div class="api-table">
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
      </div>
    </template>
    <template v-for="table in MEMBER_TABLES" :key="table.key">
      <template v-if="part[table.key].length > 0">
        <h4>{{ table.title }}</h4>
        <div class="api-table">
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
        </div>
      </template>
    </template>
  </section>
</template>
