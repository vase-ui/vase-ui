<script setup lang="ts">
import { matchSorter } from 'match-sorter';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import styles from './index.module.css';

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
    category: 'Vue',
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
    category: 'Vue',
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
    category: 'Vue',
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
    <label :class="styles.Label">
      Fuzzy search documentation
      <Autocomplete.Input placeholder="e.g. Vue" :class="styles.Input" />
    </label>

    <Autocomplete.Portal>
      <Autocomplete.Positioner :class="styles.Positioner" :side-offset="4">
        <Autocomplete.Popup :class="styles.Popup">
          <Autocomplete.Empty>
            <div :class="styles.Empty">No results found for "<Autocomplete.Value />"</div>
          </Autocomplete.Empty>

          <Autocomplete.List :class="styles.List">
            <template #item="{ item }">
              <Autocomplete.Item :value="item" :class="styles.Item">
                <Autocomplete.Value v-slot="{ value }">
                  <span :class="styles.ItemContent">
                    <span :class="styles.ItemHeader">
                      <span :class="styles.ItemTitle">
                        <template
                          v-for="(part, index) in highlightText(item.title, value)"
                          :key="index"
                        >
                          <mark v-if="part.match">{{ part.text }}</mark>
                          <template v-else>{{ part.text }}</template>
                        </template>
                      </span>
                    </span>
                    <span :class="styles.ItemDescription">
                      <template
                        v-for="(part, index) in highlightText(item.description, value)"
                        :key="index"
                      >
                        <mark v-if="part.match">{{ part.text }}</mark>
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
