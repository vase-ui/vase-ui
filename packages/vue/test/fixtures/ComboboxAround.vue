<script setup lang="ts">
import type { PropType } from 'vue';
import { Combobox } from '../../src/combobox';
import { Dialog } from '../../src/dialog';
import { Popover } from '../../src/popover';
import { Toolbar } from '../../src/toolbar';

// A combobox of fruits in an open popover, in a dialog, or in `Toolbar.Input` between two buttons.
defineProps({
  around: { type: String as PropType<'popover' | 'dialog' | 'toolbar'>, required: true },
});
const FRUITS = ['Apple', 'Banana', 'Cherry'];
</script>

<template>
  <Popover.Root v-if="around === 'popover'" default-open>
    <Popover.Trigger>Open</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup data-testid="popover">
          <Combobox.Root :items="FRUITS">
            <Combobox.Input data-testid="input" aria-label="Fruit" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup data-testid="popup">
                  <Combobox.List>
                    <template #item="{ item }">
                      <Combobox.Item :value="item" :data-testid="`item-${item}`">
                        {{ item }}
                      </Combobox.Item>
                    </template>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
  <Dialog.Root v-else-if="around === 'dialog'">
    <Dialog.Trigger data-testid="dialog-trigger">Open</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup data-testid="dialog" aria-label="Fruit">
        <Combobox.Root :items="FRUITS">
          <Combobox.Input data-testid="input" aria-label="Fruit" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup">
                <Combobox.List>
                  <template #item="{ item }">
                    <Combobox.Item :value="item" :data-testid="`item-${item}`">
                      {{ item }}
                    </Combobox.Item>
                  </template>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <Toolbar.Root v-else>
    <Toolbar.Button data-testid="first">First</Toolbar.Button>
    <Combobox.Root :items="FRUITS">
      <Toolbar.Input>
        <template #element="{ props, elementRef }">
          <Combobox.Input data-testid="input" aria-label="Fruit" v-bind="props" :ref="elementRef" />
        </template>
      </Toolbar.Input>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup data-testid="popup">
            <Combobox.List>
              <template #item="{ item }">
                <Combobox.Item :value="item" :data-testid="`item-${item}`">{{
                  item
                }}</Combobox.Item>
              </template>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
    <Toolbar.Button data-testid="last">Last</Toolbar.Button>
  </Toolbar.Root>
</template>
