<script setup lang="ts">
import { h, useId } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import styles from './index.module.css';

const id = useId();

const ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  style: { display: 'block' },
};

const CheckIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'none', stroke: 'currentColor', ...attrs }, [
    h('path', { d: 'm2.5 8.5 4 4 7-9' }),
  ]);

const XIcon: FunctionalComponent = (_, { attrs }) =>
  h(
    'svg',
    {
      ...ICON_PROPS,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      ...attrs,
    },
    [h('path', { d: 'm4.5 4.5 7 7m-7 0 7-7' })],
  );

interface ProgrammingLanguage {
  id: string;
  value: string;
}

const langs: ProgrammingLanguage[] = [
  { id: 'js', value: 'JavaScript' },
  { id: 'ts', value: 'TypeScript' },
  { id: 'py', value: 'Python' },
  { id: 'java', value: 'Java' },
  { id: 'cpp', value: 'C++' },
  { id: 'cs', value: 'C#' },
  { id: 'php', value: 'PHP' },
  { id: 'ruby', value: 'Ruby' },
  { id: 'go', value: 'Go' },
  { id: 'rust', value: 'Rust' },
  { id: 'swift', value: 'Swift' },
];
</script>

<template>
  <Combobox.Root :items="langs" multiple>
    <div :class="styles.Container">
      <label :class="styles.Label" :for="id">Programming languages</label>
      <Combobox.InputGroup :class="styles.InputGroup">
        <Combobox.Value v-slot="{ value }">
          <Combobox.Chips
            :class="styles.Chips"
            :aria-label="value.length > 0 ? 'Selected languages' : undefined"
          >
            <Combobox.Chip
              v-for="language in value"
              :key="language.id"
              :class="styles.Chip"
              :aria-label="language.value"
              aria-description="Press Backspace or Delete to remove"
            >
              {{ language.value }}
              <Combobox.ChipRemove
                :class="styles.ChipRemove"
                :aria-label="`Remove ${language.value}`"
              >
                <XIcon />
              </Combobox.ChipRemove>
            </Combobox.Chip>
            <Combobox.Input
              :id="id"
              :placeholder="value.length > 0 ? '' : 'e.g. TypeScript'"
              :aria-description="
                value.length > 0
                  ? `${value.length} selected. From the start of the input, press Left Arrow to focus the selected items`
                  : undefined
              "
              :class="styles.Input"
            />
          </Combobox.Chips>
        </Combobox.Value>
      </Combobox.InputGroup>
    </div>

    <Combobox.Portal>
      <Combobox.Positioner :class="styles.Positioner" :side-offset="4">
        <Combobox.Popup :class="styles.Popup">
          <Combobox.Empty>
            <div :class="styles.Empty">No languages found.</div>
          </Combobox.Empty>
          <Combobox.List>
            <template #item="{ item: language }">
              <Combobox.Item v-slot="{ state }" :class="styles.Item" :value="language">
                <span v-if="state.selected" :class="styles.ItemIndicator">
                  <CheckIcon />
                </span>
                <span :class="styles.ItemText">{{ language.value }}</span>
              </Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
