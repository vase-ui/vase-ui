<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import UnmountLog from './UnmountLog.vue';

type Props = Record<string, unknown>;
type JsHooks = { enter(done: () => void): void; leave(done: () => void): void };

defineProps({
  root: Object as PropType<Props>,
  items: { type: Array as PropType<unknown[]>, default: () => ['apple', 'apricot', 'banana'] },
  inputInPopup: Boolean,
  popup: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  jsHooks: Object as PropType<JsHooks>,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => ({ add() {} }) },
});
</script>

<template>
  <Combobox.Root :items="items" v-bind="root">
    <Combobox.Trigger v-if="inputInPopup" data-testid="trigger"
      ><Combobox.Value
    /></Combobox.Trigger>
    <template v-else>
      <Combobox.Input data-testid="input" />
      <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
    </template>
    <Combobox.Portal>
      <Transition
        v-if="backdrop"
        name="combobox-fade"
        @after-leave="log.add('backdrop-after-leave')"
      >
        <Combobox.Backdrop data-testid="backdrop" v-bind="backdrop" />
      </Transition>
      <Combobox.Positioner>
        <Transition
          v-if="jsHooks"
          :css="false"
          @before-enter="log.add('before-enter')"
          @enter="(_el: Element, done: () => void) => jsHooks?.enter(done)"
          @after-enter="log.add('after-enter')"
          @leave="(_el: Element, done: () => void) => jsHooks?.leave(done)"
          @after-leave="log.add('after-leave')"
        >
          <Combobox.Popup data-testid="popup" v-bind="popup">
            <Combobox.Input v-if="inputInPopup" data-testid="input" />
            <Combobox.Empty>No match.</Combobox.Empty>
            <Combobox.List>
              <template #item="{ item }">
                <Combobox.Item :value="item" :data-testid="`item-${item}`">{{
                  item
                }}</Combobox.Item>
              </template>
            </Combobox.List>
            <UnmountLog :log />
          </Combobox.Popup>
        </Transition>
        <Transition
          v-else
          name="combobox-leave"
          @after-enter="log.add('after-enter')"
          @after-leave="log.add('after-leave')"
        >
          <Combobox.Popup data-testid="popup" v-bind="popup">
            <Combobox.Input v-if="inputInPopup" data-testid="input" />
            <Combobox.Empty>No match.</Combobox.Empty>
            <Combobox.List>
              <template #item="{ item }">
                <Combobox.Item :value="item" :data-testid="`item-${item}`">{{
                  item
                }}</Combobox.Item>
              </template>
            </Combobox.List>
            <UnmountLog :log />
          </Combobox.Popup>
        </Transition>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>

<style>
.combobox-fade-enter-from,
.combobox-fade-leave-to,
.combobox-leave-enter-from,
.combobox-leave-leave-to {
  opacity: 0;
}
.combobox-leave-leave-active {
  transition: opacity 400ms linear;
}
.slow.combobox-fade-enter-active,
.slow.combobox-fade-leave-active,
.slow.combobox-leave-enter-active,
.slow.combobox-leave-leave-active {
  transition: opacity 3s linear;
}
</style>
