<script setup lang="ts">
import type { PropType } from 'vue';
import { Select } from '../../src/select';

type Props = Record<string, unknown>;

// A select whose popup is in a `<Transition>` of 100 ms, with no `appear`. `backdrop` adds a
// backdrop that covers the view, in a `<Transition>` of its own. `noRoot` renders a trigger with no
// root.
defineProps({
  root: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  backdrop: Boolean,
  noRoot: Boolean,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => ({ add() {} }) },
});
</script>

<template>
  <Select.Trigger v-if="noRoot" />
  <Select.Root v-else v-bind="root">
    <Select.Trigger data-testid="trigger"><Select.Value /></Select.Trigger>
    <Select.Portal>
      <Transition
        v-if="backdrop"
        name="pop"
        @after-enter="log.add('backdrop after-enter')"
        @after-leave="log.add('backdrop after-leave')"
      >
        <Select.Backdrop data-testid="backdrop" style="position: fixed; inset: 0" />
      </Transition>
      <Select.Positioner data-testid="positioner" :align-item-with-trigger="false">
        <Transition
          name="pop"
          @before-enter="log.add('before-enter')"
          @after-enter="log.add('after-enter')"
          @before-leave="log.add('before-leave')"
          @after-leave="log.add('after-leave')"
        >
          <Select.Popup data-testid="popup" v-bind="popup">
            <Select.Item value="a">A</Select.Item>
            <Select.Item value="b">B</Select.Item>
          </Select.Popup>
        </Transition>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>

<style>
.pop-enter-active,
.pop-leave-active {
  transition: opacity 100ms;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
}
.flex {
  display: flex;
}
</style>
