<script setup lang="ts">
import { Popover } from '../../src/popover';
import { Select } from '../../src/select';
</script>

<!-- A select in a popover, and a popover in the popup of the select. -->
<template>
  <Popover.Root>
    <Popover.Trigger data-testid="popover-trigger">Popover</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup data-testid="popover-popup">
          <Select.Root>
            <Select.Trigger data-testid="trigger"><Select.Value /></Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner" :align-item-with-trigger="false">
                <Select.Popup data-testid="popup">
                  <Select.Item value="a">A</Select.Item>
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
</template>
