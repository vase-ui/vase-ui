<script lang="ts">
export interface ToolbarFixtureItem {
  key: string;
  kind?:
    | 'button'
    | 'span'
    | 'disabled-button'
    | 'link'
    | 'input'
    | 'textarea'
    | 'checkbox'
    | 'separator';
  attrs?: Record<string, unknown>;
}
</script>

<script setup lang="ts">
import type { PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import { Toolbar } from '../../src/toolbar';

defineProps({ item: { type: Object as PropType<ToolbarFixtureItem>, required: true } });
</script>

<template>
  <Toolbar.Separator v-if="item.kind === 'separator'" :id="item.key" v-bind="item.attrs" />
  <Toolbar.Link v-else-if="item.kind === 'link'" :id="item.key" href="#link" v-bind="item.attrs">
    {{ item.key }}
  </Toolbar.Link>
  <Toolbar.Input
    v-else-if="item.kind === 'input'"
    :id="item.key"
    :aria-label="item.key"
    v-bind="item.attrs"
  />
  <Toolbar.Input v-else-if="item.kind === 'textarea'" v-bind="item.attrs">
    <template #element="{ props, elementRef }">
      <textarea :id="item.key" :aria-label="item.key" v-bind="props" :ref="elementRef" />
    </template>
  </Toolbar.Input>
  <Toolbar.Input v-else-if="item.kind === 'checkbox'" v-bind="item.attrs">
    <template #element="{ props, elementRef }">
      <Checkbox :id="item.key" :aria-label="item.key" v-bind="props" :ref="elementRef" />
    </template>
  </Toolbar.Input>
  <!-- The developer disables the button in the slot, and the part does not know it. -->
  <Toolbar.Button v-else-if="item.kind === 'disabled-button'" v-bind="item.attrs">
    <template #element="{ props, elementRef }">
      <button :id="item.key" v-bind="props" :ref="elementRef" disabled>{{ item.key }}</button>
    </template>
  </Toolbar.Button>
  <Toolbar.Button v-else-if="item.kind === 'span'" v-bind="item.attrs">
    <template #element="{ props, elementRef }">
      <span :id="item.key" v-bind="props" :ref="elementRef">{{ item.key }}</span>
    </template>
  </Toolbar.Button>
  <Toolbar.Button v-else :id="item.key" v-bind="item.attrs">{{ item.key }}</Toolbar.Button>
</template>
