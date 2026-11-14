<script setup lang="ts">
import type { Directive } from 'vue';
import ElementSiblingsProbe from './ElementSiblingsProbe.test.vue';

withDefaults(
  defineProps<{
    items?: string[];
    placed?: boolean;
    shown?: boolean;
    as?: string;
    rendered?: boolean;
    mode?: 'list' | 'replace' | 'keep-alive' | 'transition' | 'show';
  }>(),
  {
    items: () => ['element'],
    placed: true,
    shown: true,
    as: 'button',
    rendered: true,
    mode: 'list',
  },
);

const vMark: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.setAttribute('data-mark', binding.value);
  },
};
</script>

<template>
  <div data-testid="host">
    <template v-if="mode === 'list'">
      <template v-for="item in items" :key="item">
        <ElementSiblingsProbe
          v-if="item === 'element'"
          v-mark="'marked'"
          class="probe"
          :placed="placed"
          :as="as"
          :rendered="rendered"
        />
        <b v-else :data-testid="item" />
      </template>
    </template>
    <template v-else-if="mode === 'replace'">
      <ElementSiblingsProbe v-if="shown" :placed="placed" />
      <em v-else data-testid="replacement" />
    </template>
    <KeepAlive v-else-if="mode === 'keep-alive'">
      <ElementSiblingsProbe v-if="shown" :placed="placed" />
    </KeepAlive>
    <Transition v-else-if="mode === 'transition'">
      <ElementSiblingsProbe v-if="shown" :placed="placed" />
    </Transition>
    <ElementSiblingsProbe v-else v-show="shown" :placed="placed" />
    <u data-testid="end" />
  </div>
</template>

<style scoped>
.probe {
  outline-style: dashed;
}
</style>
