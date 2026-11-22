<script setup lang="ts">
import type { PropType } from 'vue';
import { Popover } from '../../src/popover';
import { Select } from '../../src/select';

type Props = Record<string, unknown>;

// A select in a popover, and a popover in the popup of the select. `popover`, `root` and
// `positioner` give props to the outer Popover.Root, Select.Root and Select.Positioner.
defineProps({
  popover: Object as PropType<Props>,
  root: Object as PropType<Props>,
  positioner: { type: Object as PropType<Props>, default: () => ({ alignItemWithTrigger: false }) },
});
</script>

<template>
  <Popover.Root v-bind="popover">
    <Popover.Trigger data-testid="popover-trigger">Popover</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup data-testid="popover-popup">
          <Select.Root v-bind="root">
            <Select.Trigger data-testid="trigger"><Select.Value /></Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner" v-bind="positioner">
                <Select.Popup data-testid="popup">
                  <Select.Item value="a" data-testid="item-a">A</Select.Item>
                  <Select.Item value="b" data-testid="item-b">B</Select.Item>
                  <Popover.Root>
                    <Popover.Trigger data-testid="inner-trigger">Inner</Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Positioner>
                        <Popover.Popup data-testid="inner-popup">
                          <button data-testid="inner-button">Inner button</button>
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
