<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Select } from '@vase-ui/vue/select';

const languages = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  csharp: 'C#',
  php: 'PHP',
  cpp: 'C++',
  rust: 'Rust',
  go: 'Go',
  swift: 'Swift',
};

type Language = keyof typeof languages;

const values = Object.keys(languages) as Language[];

function renderValue(value: Language[]) {
  if (value.length === 0) {
    return 'Select languages';
  }

  const firstLanguage = languages[value[0]];
  const additionalLanguages = value.length > 1 ? ` (+${value.length - 1} more)` : '';
  return firstLanguage + additionalLanguages;
}

const ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  style: { display: 'block' },
};

const CaretUpDownIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'currentColor', ...attrs }, [
    h('path', { d: 'M11 10H5l3 3.5zm0-4H5l3-3.5z' }),
  ]);

const CheckIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'none', stroke: 'currentColor', ...attrs }, [
    h('path', { d: 'm2.5 8.5 4 4 7-9' }),
  ]);
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <Select.Root multiple :default-value="['javascript', 'typescript']">
      <Select.Label class="cursor-default text-sm font-bold text-neutral-950 dark:text-white"
        >Languages</Select.Label
      >
      <Select.Trigger
        class="flex h-8 min-w-[14rem] items-center justify-between gap-3 pl-2 pr-1 text-sm leading-none whitespace-nowrap border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 text-neutral-950 dark:text-white select-none hover:enabled:bg-neutral-100 dark:hover:enabled:bg-neutral-800 active:enabled:bg-neutral-200 dark:active:enabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 data-pressed:bg-neutral-100 dark:data-pressed:bg-neutral-800 font-normal focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      >
        <Select.Value
          v-slot="{ value }"
          class="data-placeholder:text-neutral-500 dark:data-placeholder:text-neutral-400"
        >
          {{ renderValue(value) }}
        </Select.Value>
        <Select.Icon>
          <CaretUpDownIcon />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          class="outline-hidden z-10"
          :side-offset="4"
          :align-item-with-trigger="false"
        >
          <Select.Popup
            class="group max-h-[var(--available-height)] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] bg-clip-padding overflow-y-auto border border-neutral-950 bg-white py-1 text-neutral-950 outline-hidden shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-[side=none]:min-w-[calc(var(--anchor-width)+1.75rem)] data-[side=none]:data-ending-style:transition-none data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-starting-style:opacity-100 data-[side=none]:data-starting-style:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
          >
            <Select.Item
              v-for="value in values"
              :key="value"
              :value="value"
              class="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 py-1.5 pr-2.5 pl-2.5 text-sm outline-hidden select-none scroll-my-1 [@media(hover:hover)]:data-highlighted:bg-neutral-950 [@media(hover:hover)]:data-highlighted:text-white dark:[@media(hover:hover)]:data-highlighted:bg-white dark:[@media(hover:hover)]:data-highlighted:text-neutral-950"
              v-slot="{ state }"
            >
              <span v-if="state.selected" class="col-start-1">
                <CheckIcon />
              </span>
              <Select.ItemText class="col-start-2">{{ languages[value] }}</Select.ItemText>
            </Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  </div>
</template>
