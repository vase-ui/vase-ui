<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';
import { ScrollArea } from '../../src/scroll-area';

// A command palette: an open filterable menu in the popup of a dialog, with its items in a scroll
// area. The menu has no trigger, so the heading of the dialog is its anchor.
const heading = useTemplateRef('heading');
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger data-testid="dialog-trigger">Open palette</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup aria-label="Command palette">
        <h2 ref="heading">Commands</h2>
        <Menu.FilterProvider auto-highlight="always">
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner :anchor="heading">
                <Menu.Popup data-testid="popup">
                  <Menu.Input data-testid="input" aria-label="Search commands" />
                  <Dialog.Close>Close palette</Dialog.Close>
                  <ScrollArea.Root>
                    <ScrollArea.Viewport>
                      <ScrollArea.Content>
                        <Menu.List>
                          <Menu.Group>
                            <Menu.GroupLabel>Suggestions</Menu.GroupLabel>
                            <Menu.Item data-key="linear">Linear</Menu.Item>
                            <Menu.Item data-key="figma">Figma</Menu.Item>
                          </Menu.Group>
                        </Menu.List>
                      </ScrollArea.Content>
                    </ScrollArea.Viewport>
                    <ScrollArea.Scrollbar>
                      <ScrollArea.Thumb />
                    </ScrollArea.Scrollbar>
                  </ScrollArea.Root>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
