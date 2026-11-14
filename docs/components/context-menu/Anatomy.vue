<script setup lang="ts">
import { ContextMenu } from '@vase-ui/vue/context-menu';
</script>

<template>
  <ContextMenu.Root>
    <ContextMenu.Trigger />
    <ContextMenu.Portal>
      <ContextMenu.Backdrop />
      <ContextMenu.Positioner>
        <ContextMenu.Popup>
          <ContextMenu.Arrow />
          <ContextMenu.Item />
          <ContextMenu.LinkItem />
          <ContextMenu.Separator />

          <ContextMenu.SubmenuRoot>
            <ContextMenu.SubmenuTrigger />
          </ContextMenu.SubmenuRoot>

          <ContextMenu.Group>
            <ContextMenu.GroupLabel />
          </ContextMenu.Group>

          <ContextMenu.RadioGroup>
            <ContextMenu.RadioItem value="">
              <ContextMenu.RadioItemIndicator />
            </ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>

          <ContextMenu.CheckboxItem>
            <ContextMenu.CheckboxItemIndicator />
          </ContextMenu.CheckboxItem>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  </ContextMenu.Root>
</template>
