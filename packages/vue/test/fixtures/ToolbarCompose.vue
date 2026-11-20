<script setup lang="ts">
import type { PropType } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';
import { NumberField } from '../../src/number-field';
import { Popover } from '../../src/popover';
import { Radio } from '../../src/radio';
import { RadioGroup } from '../../src/radio-group';
import { Select } from '../../src/select';
import { Switch } from '../../src/switch';
import { Toggle } from '../../src/toggle';
import { ToggleGroup } from '../../src/toggle-group';
import { Toolbar } from '../../src/toolbar';
import { Tooltip } from '../../src/tooltip';

// A part of another family in the `element` slot of a toolbar part, between the buttons `first`
// and `last`.
defineProps({
  scene: {
    type: Object as PropType<{
      kind:
        | 'menu'
        | 'select'
        | 'dialog'
        | 'alert-dialog'
        | 'popover'
        | 'tooltip'
        | 'toggle'
        | 'toggle-group'
        | 'switch'
        | 'radio'
        | 'number-field';
      disabled?: boolean;
      orientation?: 'horizontal' | 'vertical';
      loopFocus?: boolean;
      /** The toolbar has no button after the part. */
      noLast?: boolean;
    }>,
    required: true,
  },
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
</script>

<template>
  <input id="before" aria-label="Before" />
  <Toolbar.Root :orientation="scene.orientation" :loop-focus="scene.loopFocus ?? true">
    <Toolbar.Button id="first">First</Toolbar.Button>
    <Menu.Root v-if="scene.kind === 'menu'" @open-change="(open) => log.add(`open ${open}`)">
      <Toolbar.Button :disabled="scene.disabled">
        <template #element="{ props, elementRef }">
          <Menu.Trigger id="trigger" v-bind="props" :ref="elementRef">Menu</Menu.Trigger>
        </template>
      </Toolbar.Button>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Item id="item-1">1</Menu.Item>
            <Menu.Item id="item-2">2</Menu.Item>
            <Menu.Item id="item-3">3</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
    <Select.Root
      v-else-if="scene.kind === 'select'"
      default-value="a"
      @open-change="(open) => log.add(`open ${open}`)"
      @value-change="(value) => log.add(`value ${value}`)"
    >
      <Toolbar.Button :disabled="scene.disabled">
        <template #element="{ props, elementRef }">
          <Select.Trigger id="trigger" v-bind="props" :ref="elementRef">
            <Select.Value />
          </Select.Trigger>
        </template>
      </Toolbar.Button>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <Select.Item id="item-a" value="a">a</Select.Item>
            <Select.Item id="item-b" value="b">b</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
    <Dialog.Root
      v-else-if="scene.kind === 'dialog'"
      :modal="false"
      @open-change="(open) => log.add(`open ${open}`)"
    >
      <Toolbar.Button :disabled="scene.disabled">
        <template #element="{ props, elementRef }">
          <Dialog.Trigger id="trigger" v-bind="props" :ref="elementRef">Dialog</Dialog.Trigger>
        </template>
      </Toolbar.Button>
      <Dialog.Portal>
        <Dialog.Popup>
          <Dialog.Title>Title</Dialog.Title>
          <button id="inside" type="button">Inside</button>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <AlertDialog.Root
      v-else-if="scene.kind === 'alert-dialog'"
      @open-change="(open) => log.add(`open ${open}`)"
    >
      <Toolbar.Button :disabled="scene.disabled">
        <template #element="{ props, elementRef }">
          <AlertDialog.Trigger id="trigger" v-bind="props" :ref="elementRef">
            Alert
          </AlertDialog.Trigger>
        </template>
      </Toolbar.Button>
      <AlertDialog.Portal>
        <AlertDialog.Popup>
          <AlertDialog.Title>Title</AlertDialog.Title>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
    <template v-else-if="scene.kind === 'popover'">
      <Popover.Root @open-change="(open) => log.add(`open ${open}`)">
        <Toolbar.Button :disabled="scene.disabled">
          <template #element="{ props, elementRef }">
            <Popover.Trigger id="trigger" v-bind="props" :ref="elementRef">Popover</Popover.Trigger>
          </template>
        </Toolbar.Button>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup id="popup">Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <Toolbar.Button id="disabled" disabled>Disabled</Toolbar.Button>
    </template>
    <Tooltip.Root v-else-if="scene.kind === 'tooltip'">
      <Tooltip.Trigger id="trigger" :delay="20">
        <template #element="{ props, elementRef }">
          <Toolbar.Button :disabled="scene.disabled" v-bind="props" :ref="elementRef">
            Push
          </Toolbar.Button>
        </template>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup id="popup">Nothing to push</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
    <Toolbar.Button v-else-if="scene.kind === 'toggle'" :disabled="scene.disabled">
      <template #element="{ props, elementRef }">
        <Toggle id="trigger" v-bind="props" :ref="elementRef">Bold</Toggle>
      </template>
    </Toolbar.Button>
    <ToggleGroup v-else-if="scene.kind === 'toggle-group'" :default-value="['one']">
      <Toolbar.Button :disabled="scene.disabled">
        <template #element="{ props, elementRef }">
          <Toggle id="trigger" value="two" v-bind="props" :ref="elementRef">Two</Toggle>
        </template>
      </Toolbar.Button>
      <Toggle id="one" value="one">One</Toggle>
    </ToggleGroup>
    <Toolbar.Input v-else-if="scene.kind === 'switch'" :disabled="scene.disabled">
      <template #element="{ props, elementRef }">
        <Switch
          id="trigger"
          aria-label="Wrap"
          v-bind="props"
          :ref="elementRef"
          @checked-change="(checked) => log.add(`checked ${checked}`)"
        />
      </template>
    </Toolbar.Input>
    <RadioGroup v-else-if="scene.kind === 'radio'" name="align" default-value="left">
      <Toolbar.Input v-for="value in ['left', 'center', 'right']" :key="value">
        <template #element="{ props, elementRef }">
          <Radio :id="value" :value="value" :aria-label="value" v-bind="props" :ref="elementRef" />
        </template>
      </Toolbar.Input>
    </RadioGroup>
    <NumberField.Root
      v-else-if="scene.kind === 'number-field'"
      :default-value="5"
      @value-change="(value) => log.add(`value ${value}`)"
    >
      <Toolbar.Input :disabled="scene.disabled">
        <template #element="{ props, elementRef }">
          <NumberField.Input id="trigger" aria-label="Size" v-bind="props" :ref="elementRef" />
        </template>
      </Toolbar.Input>
    </NumberField.Root>
    <Toolbar.Button v-if="!scene.noLast" id="last">Last</Toolbar.Button>
  </Toolbar.Root>
  <input id="after" aria-label="After" />
</template>
