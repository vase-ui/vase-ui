<!-- @strictTemplates true -->
<script setup lang="ts">
// vue-tsc checks the bindings of this template. No test mounts the component.
// The first line of the file sets `strictTemplates` for this file only.
import { Button } from '@vase-ui/vue/button';
import { mergeProps } from '@vase-ui/vue/merge-props';

const first = { class: 'first', onClick: () => {} };
const second = { class: 'second', onClick: () => {} };
</script>

<template>
  <button type="button" v-bind="mergeProps(first, second)">No type argument</button>
  <button type="button" v-bind="mergeProps<'button'>(first, second)">Type argument</button>
  <Button v-bind="mergeProps(first, second)">Part</Button>
  <Button>
    <template #element="{ props, elementRef }">
      <button v-bind="mergeProps(props, { class: 'button' })" :ref="elementRef">
        No type argument
      </button>
    </template>
  </Button>
  <Button>
    <template #element="{ props, elementRef }">
      <button v-bind="mergeProps<'button'>(props, { class: 'button' })" :ref="elementRef">
        Type argument
      </button>
    </template>
  </Button>
  <a v-bind="mergeProps({ href: '/' }, second)">Attribute of a link</a>
  <button v-bind="mergeProps({ type: 'submit' }, second)">Attribute of a button</button>
  <label v-bind="mergeProps({ for: 'id' }, second)">Attribute of a label</label>
  <input v-bind="mergeProps({ value: 1 }, second)" />
  <div v-bind="mergeProps({ 'data-state': 'on' }, second)">Data attribute</div>
  <Button v-bind="mergeProps({ type: 'submit' }, second)">Part</Button>
  <Button>
    <template #element="{ props, elementRef }">
      <a v-bind="mergeProps(props, { href: '/' })" :ref="elementRef">Attribute of a link</a>
    </template>
  </Button>
</template>
