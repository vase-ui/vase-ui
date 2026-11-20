<script setup lang="ts">
import { computed, provide, shallowReactive, watch, type PropType } from 'vue';
import MeasureListedLink from './MeasureListedLink.vue';

// A list of links, as a root keeps its triggers. A `v-if` with a `key` renders the link with the id
// `first`. A watcher with `flush: 'post'` writes each value of "a mounted link has the id `first`".
const props = defineProps({
  scene: { type: Object as PropType<{ shown: boolean; key: number }>, required: true },
  log: { type: Array as PropType<boolean[]>, required: true },
});
const links = shallowReactive<{ readonly id: string; readonly element: Element | null }[]>([]);
provide('links', links);
const mounted = computed(() => links.some((link) => link.id === 'first' && !!link.element));
watch(mounted, (value) => props.log.push(value), { flush: 'post' });
</script>

<template>
  <MeasureListedLink v-if="scene.shown" :key="scene.key" id="first" />
</template>
