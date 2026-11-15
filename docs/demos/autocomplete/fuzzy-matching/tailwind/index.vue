<script setup lang="ts">
import { matchSorter } from 'match-sorter';
import { Autocomplete } from '@vase-ui/vue/autocomplete';

const markClass = 'bg-transparent font-bold text-blue-800 dark:text-blue-500';

interface HighlightedPart {
  text: string;
  match: boolean;
}

function highlightText(text: string, query: string): HighlightedPart[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [{ text, match: false }];
  }

  const limited = trimmed.slice(0, 100);
  const escaped = limited.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');

  // A split with a capture group puts each match at an odd index.
  return text
    .split(regex)
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((part) => part.text !== '');
}

function fuzzyFilter(item: FuzzyItem, query: string): boolean {
  if (!query) {
    return true;
  }

  const results = matchSorter([item], query, {
    keys: [
      'title',
      'description',
      'category',
      { key: 'title', threshold: matchSorter.rankings.CONTAINS },
      { key: 'description', threshold: matchSorter.rankings.WORD_STARTS_WITH },
    ],
  });

  return results.length > 0;
}

interface FuzzyItem {
  title: string;
  description: string;
  category: string;
}

const fuzzyItems: FuzzyItem[] = [
  {
    title: 'Vue Composables Guide',
    description: 'Learn how to use Vue composables like ref, computed, and custom composables',
    category: 'Vue.js',
  },
  {
    title: 'JavaScript Array Methods',
    description: 'Master array methods like map, filter, reduce, and forEach in JavaScript',
    category: 'JavaScript',
  },
  {
    title: 'CSS Flexbox Layout',
    description: 'Complete guide to CSS Flexbox for responsive web design',
    category: 'CSS',
  },
  {
    title: 'TypeScript Interfaces',
    description: 'Understanding TypeScript interfaces and type definitions',
    category: 'TypeScript',
  },
  {
    title: 'Vue Performance Optimization',
    description: 'Tips and techniques for optimizing Vue application performance',
    category: 'Vue.js',
  },
  {
    title: 'HTML Semantic Elements',
    description: 'Using semantic HTML elements for better accessibility and SEO',
    category: 'HTML',
  },
  {
    title: 'Node.js Express Server',
    description: 'Building RESTful APIs with Node.js and Express framework',
    category: 'Node.js',
  },
  {
    title: 'Vue Composition API',
    description: 'Modern Vue.js development using the Composition API',
    category: 'Vue.js',
  },
  {
    title: 'Angular Components',
    description: 'Creating reusable Angular components with TypeScript',
    category: 'Angular',
  },
  {
    title: 'Python Django Framework',
    description: 'Web development with Python Django framework',
    category: 'Python',
  },
  {
    title: 'CSS Grid Layout',
    description: 'Advanced CSS Grid techniques for complex layouts',
    category: 'CSS',
  },
  {
    title: 'Vue Testing Library',
    description: 'Testing Vue components with Vue Testing Library',
    category: 'Vue.js',
  },
  {
    title: 'MongoDB Queries',
    description: 'Advanced MongoDB queries and aggregation pipelines',
    category: 'Database',
  },
  {
    title: 'Webpack Configuration',
    description: 'Optimizing webpack configuration for production builds',
    category: 'Build Tools',
  },
  {
    title: 'SASS/SCSS Guide',
    description: 'Writing maintainable CSS with SASS and SCSS',
    category: 'CSS',
  },
];
</script>

<template>
  <Autocomplete.Root
    :items="fuzzyItems"
    :filter="fuzzyFilter"
    :item-to-string-value="(item: FuzzyItem) => item.title"
  >
    <label class="flex flex-col gap-1 text-sm font-bold text-neutral-950 dark:text-white">
      Fuzzy search documentation
      <Autocomplete.Input
        placeholder="e.g. Vue"
        class="h-8 w-[16rem] border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
      />
    </label>

    <Autocomplete.Portal>
      <Autocomplete.Positioner class="outline-hidden" :side-offset="4">
        <Autocomplete.Popup
          class="w-(--anchor-width) max-w-(--available-width) border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
        >
          <Autocomplete.Empty>
            <div class="py-3 pr-4 pl-2 text-sm leading-4 text-neutral-500 dark:text-neutral-400">
              No results found for "<Autocomplete.Value />"
            </div>
          </Autocomplete.Empty>

          <Autocomplete.List
            class="flex max-h-[min(var(--available-height),28rem)] flex-col overflow-y-auto overscroll-contain py-1 scroll-pt-1 scroll-pb-1 empty:p-0"
          >
            <template #item="{ item }">
              <Autocomplete.Item
                :value="item"
                class="flex cursor-default py-3 pr-2 pl-2 text-sm leading-6 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:before:absolute data-highlighted:before:inset-x-0 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-100 dark:data-highlighted:before:bg-neutral-800"
              >
                <Autocomplete.Value v-slot="{ value }">
                  <span class="flex w-full flex-col gap-1">
                    <span class="flex items-center justify-between gap-3">
                      <span class="flex-1 font-bold leading-5">
                        <template
                          v-for="(part, index) in highlightText(item.title, value)"
                          :key="index"
                        >
                          <mark v-if="part.match" :class="markClass">{{ part.text }}</mark>
                          <template v-else>{{ part.text }}</template>
                        </template>
                      </span>
                    </span>
                    <span class="text-sm text-neutral-500 dark:text-neutral-400">
                      <template
                        v-for="(part, index) in highlightText(item.description, value)"
                        :key="index"
                      >
                        <mark v-if="part.match" :class="markClass">{{ part.text }}</mark>
                        <template v-else>{{ part.text }}</template>
                      </template>
                    </span>
                  </span>
                </Autocomplete.Value>
              </Autocomplete.Item>
            </template>
          </Autocomplete.List>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  </Autocomplete.Root>
</template>
