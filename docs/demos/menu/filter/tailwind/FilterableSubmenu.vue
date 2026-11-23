<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import {
  clearClass,
  emptyClass,
  inputClass,
  inputContainerClass,
  itemClass,
  popupClass,
  submenuListClass,
  submenuTriggerClass,
} from './classes';

defineProps<{
  label: string;
  inputLabel: string;
  placeholder: string;
  emptyText: string;
  options: readonly string[];
}>();

function getSubmenuOffset({ side }: { side: Menu.Positioner.Props['side'] }) {
  return side === 'top' || side === 'bottom' ? 4 : -4;
}

const ClearIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'm3.5 3.5 9 9m0-9-9 9' })],
  );

const CaretRightIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'M6 12V4l4.5 4z' })],
  );

const popupHiddenClass = 'scale-[0.98] opacity-0';
</script>

<template>
  <Menu.FilterProvider>
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger :class="submenuTriggerClass">
        {{ label }}
        <CaretRightIcon />
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner
          class="outline-hidden"
          :side-offset="getSubmenuOffset"
          :align-offset="getSubmenuOffset"
        >
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <Menu.Popup :class="popupClass">
              <div :class="inputContainerClass">
                <Menu.Input
                  :class="inputClass"
                  :aria-label="inputLabel"
                  :placeholder="placeholder"
                />
                <Menu.Clear :class="clearClass">
                  <ClearIcon />
                </Menu.Clear>
              </div>
              <Menu.Empty :class="emptyClass">{{ emptyText }}</Menu.Empty>
              <Menu.List :class="submenuListClass">
                <Menu.Item v-for="option in options" :key="option" :class="itemClass">
                  {{ option }}
                </Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Transition>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  </Menu.FilterProvider>
</template>
