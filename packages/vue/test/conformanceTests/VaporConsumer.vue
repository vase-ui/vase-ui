<script setup vapor lang="ts">
import type { Component } from 'vue';

defineProps<{
  part: Component;
  partProps: Record<string, unknown>;
  /** The default slot of the vnode of the call. */
  content?: Component;
  /** The element that `as` names or that the `#render` slot renders. */
  tag: string;
  form: 'as' | 'render' | 'render-without-ref';
  onPart: (part: unknown) => void;
}>();
</script>

<template>
  <component :is="part" v-if="form === 'as'" v-bind="partProps" :as="tag" :ref="onPart">
    <template v-if="content" #default>
      <component :is="content" />
    </template>
  </component>
  <component :is="part" v-else-if="form === 'render'" v-bind="partProps" :ref="onPart">
    <template v-if="content" #default>
      <component :is="content" />
    </template>
    <template #render="{ props, children }">
      <a v-if="tag === 'a'" v-bind="props" :ref="props.ref">
        <component :is="children" v-if="children" />
      </a>
      <button v-else-if="tag === 'button'" v-bind="props" :ref="props.ref">
        <component :is="children" v-if="children" />
      </button>
      <input v-else-if="tag === 'input'" v-bind="props" :ref="props.ref" />
      <label v-else-if="tag === 'label'" v-bind="props" :ref="props.ref">
        <component :is="children" v-if="children" />
      </label>
      <span v-else-if="tag === 'span'" v-bind="props" :ref="props.ref">
        <component :is="children" v-if="children" />
      </span>
      <div v-else v-bind="props" :ref="props.ref">
        <component :is="children" v-if="children" />
      </div>
    </template>
  </component>
  <component :is="part" v-else v-bind="partProps" :ref="onPart">
    <template v-if="content" #default>
      <component :is="content" />
    </template>
    <template #render="{ props }">
      <div v-bind="props" />
    </template>
  </component>
</template>
