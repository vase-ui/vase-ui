<script setup lang="ts">
// vue-tsc checks the bindings of this template. No test mounts the component.
import { Button } from '@vase-ui/vue/button';
import { mergeProps } from '@vase-ui/vue/merge-props';
import type { HTMLProps } from '@vase-ui/vue/types';

const first = { class: 'first', onClick: () => {} };
const second = { class: 'second', onClick: () => {} };

function getPropsWithHandler(props: HTMLProps) {
  return mergeProps<'div'>(props, {
    onKeydown(event) {
      event.preventVaseUIHandler();
    },
  });
}
</script>

<template>
  <button type="button" v-bind="mergeProps(first, second)">No type argument</button>
  <button type="button" v-bind="mergeProps<'button'>(first, second)">Type argument</button>
  <Button v-bind="mergeProps(first, second)">Part</Button>
  <Button>
    <template #render="{ props }">
      <button v-bind="mergeProps(props, { class: 'button' })">No type argument</button>
    </template>
  </Button>
  <Button>
    <template #render="{ props }">
      <button v-bind="mergeProps<'button'>(props, { class: 'button' })">Type argument</button>
    </template>
  </Button>
  <Button :native-button="false">
    <template #render="{ props }">
      <div v-bind="getPropsWithHandler(props)">Handler</div>
    </template>
  </Button>
</template>
