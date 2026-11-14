<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Select } from '@vase-ui/vue/select';
import { Toggle } from '@vase-ui/vue/toggle';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';
import { Toolbar } from '@vase-ui/vue/toolbar';
import styles from './index.module.css';

const ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  style: { display: 'block' },
};

const CaretUpDownIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'currentColor', ...attrs }, [
    h('path', { d: 'M11 10H5l3 3.5zm0-4H5l3-3.5z' }),
  ]);

const CheckIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'none', stroke: 'currentColor', ...attrs }, [
    h('path', { d: 'm2.5 8.5 4 4 7-9' }),
  ]);
</script>

<template>
  <Toolbar.Root :class="styles.Toolbar">
    <ToggleGroup :class="styles.Group" aria-label="Alignment">
      <Toolbar.Button
        :as="Toggle"
        aria-label="Align left"
        value="align-left"
        :class="styles.Button"
      >
        Align Left
      </Toolbar.Button>
      <Toolbar.Button
        :as="Toggle"
        aria-label="Align right"
        value="align-right"
        :class="styles.Button"
      >
        Align Right
      </Toolbar.Button>
    </ToggleGroup>
    <Toolbar.Separator :class="styles.Separator" />
    <Toolbar.Group :class="styles.Group" aria-label="Numerical format">
      <Toolbar.Button :class="styles.Button" aria-label="Format as currency">$</Toolbar.Button>
      <Toolbar.Button :class="styles.Button" aria-label="Format as percent">%</Toolbar.Button>
    </Toolbar.Group>
    <Toolbar.Separator :class="styles.Separator" />
    <Select.Root default-value="Helvetica">
      <Toolbar.Button :class="styles.Button" aria-label="Font">
        <template #render="{ props }">
          <Select.Trigger v-bind="props">
            <Select.Value />
            <Select.Icon>
              <CaretUpDownIcon />
            </Select.Icon>
          </Select.Trigger>
        </template>
      </Toolbar.Button>
      <Select.Portal>
        <Select.Positioner
          :class="styles.Positioner"
          :side-offset="4"
          :align-item-with-trigger="false"
        >
          <Select.Popup :class="styles.Popup">
            <Select.Item :class="styles.Item" value="Helvetica">
              <Select.ItemIndicator :class="styles.ItemIndicator">
                <CheckIcon />
              </Select.ItemIndicator>
              <Select.ItemText :class="styles.ItemText">Helvetica</Select.ItemText>
            </Select.Item>
            <Select.Item :class="styles.Item" value="Arial">
              <Select.ItemIndicator :class="styles.ItemIndicator">
                <CheckIcon />
              </Select.ItemIndicator>
              <Select.ItemText :class="styles.ItemText">Arial</Select.ItemText>
            </Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
    <Toolbar.Separator :class="styles.Separator" />
    <Toolbar.Link :class="styles.Link" href="#">Edited 51m ago</Toolbar.Link>
  </Toolbar.Root>
</template>
