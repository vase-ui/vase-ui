<script setup lang="ts">
import type { PropType } from 'vue';
import { Autocomplete } from '../../src/autocomplete';
import UnmountLog from './UnmountLog.vue';

type Props = Record<string, unknown>;
type JsHooks = { enter(done: () => void): void; leave(done: () => void): void };

// An autocomplete whose popup and optional backdrop animate in `<Transition>`.
defineProps({
  root: Object as PropType<Props>,
  items: { type: Array as PropType<unknown[]>, default: () => ['feature', 'fix', 'docs'] },
  popup: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  jsHooks: Object as PropType<JsHooks>,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => ({ add() {} }) },
});
</script>

<template>
  <Autocomplete.Root :items="items" v-bind="root">
    <Autocomplete.Input data-testid="input" />
    <Autocomplete.Portal>
      <Transition v-if="backdrop" name="auto-fade" @after-leave="log.add('backdrop-after-leave')">
        <Autocomplete.Backdrop data-testid="backdrop" v-bind="backdrop" />
      </Transition>
      <Autocomplete.Positioner>
        <Transition
          v-if="jsHooks"
          :css="false"
          @before-enter="log.add('before-enter')"
          @enter="(_el: Element, done: () => void) => jsHooks?.enter(done)"
          @after-enter="log.add('after-enter')"
          @leave="(_el: Element, done: () => void) => jsHooks?.leave(done)"
          @after-leave="log.add('after-leave')"
        >
          <Autocomplete.Popup data-testid="popup" v-bind="popup">
            <Autocomplete.List>
              <template #item="{ item }">
                <Autocomplete.Item :value="item" :data-testid="`item-${item}`">{{
                  item
                }}</Autocomplete.Item>
              </template>
            </Autocomplete.List>
            <UnmountLog :log />
          </Autocomplete.Popup>
        </Transition>
        <Transition
          v-else
          name="auto-leave"
          @after-enter="log.add('after-enter')"
          @after-leave="log.add('after-leave')"
        >
          <Autocomplete.Popup data-testid="popup" v-bind="popup">
            <Autocomplete.List>
              <template #item="{ item }">
                <Autocomplete.Item :value="item" :data-testid="`item-${item}`">{{
                  item
                }}</Autocomplete.Item>
              </template>
            </Autocomplete.List>
            <UnmountLog :log />
          </Autocomplete.Popup>
        </Transition>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  </Autocomplete.Root>
</template>

<style>
.auto-fade-enter-from,
.auto-fade-leave-to,
.auto-leave-enter-from,
.auto-leave-leave-to {
  opacity: 0;
}
.slow.auto-fade-enter-active,
.slow.auto-fade-leave-active,
.slow.auto-leave-enter-active,
.slow.auto-leave-leave-active {
  transition: opacity 3s linear;
}
</style>
