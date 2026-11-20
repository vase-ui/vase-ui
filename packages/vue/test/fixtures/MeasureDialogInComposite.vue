<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { Tabs } from '../../src/tabs';
import { Toolbar } from '../../src/toolbar';

// A dialog in place, with an input and a button, in the element of a toolbar or of a list of tabs.
defineProps({ host: { type: String as PropType<'toolbar' | 'tabs'>, required: true } });
</script>

<template>
  <Toolbar.Root v-if="host === 'toolbar'">
    <Toolbar.Button>First</Toolbar.Button>
    <Dialog.Root default-open :modal="false">
      <Dialog.Portal disabled>
        <Dialog.Popup data-testid="popup">
          <input aria-label="Text" value="ab" />
          <button>Inside</button>
          <button>Last inside</button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <Toolbar.Button>Last</Toolbar.Button>
  </Toolbar.Root>
  <Tabs.Root v-else default-value="a">
    <Tabs.List>
      <Tabs.Tab value="a">A</Tabs.Tab>
      <Dialog.Root default-open :modal="false">
        <Dialog.Portal disabled>
          <Dialog.Popup data-testid="popup">
            <input aria-label="Text" value="ab" />
            <button>Inside</button>
            <button>Last inside</button>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <Tabs.Tab value="b">B</Tabs.Tab>
    </Tabs.List>
  </Tabs.Root>
</template>
