<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import FilterableSubmenu from './FilterableSubmenu.vue';
import styles from './index.module.css';

const sharingOptions = [
  'Email',
  'Messages',
  'AirDrop',
  'Copy link',
  'Invite collaborators',
  'Publish to web',
  'Send a copy',
];

const folderOptions = [
  'Desktop',
  'Documents',
  'Downloads',
  'Projects',
  'Archive',
  'Shared',
  'Trash',
];

const exportOptions = [
  'PDF document',
  'Word document',
  'Plain text',
  'Rich text',
  'Markdown',
  'HTML page',
  'Image',
];

const sortOptions = [
  ['date', 'Date modified'],
  ['name', 'Name'],
  ['size', 'Size'],
] as const;

function getSubmenuOffset({ side }: { side: Menu.Positioner.Props['side'] }) {
  return side === 'top' || side === 'bottom' ? 4 : -4;
}

const CaretDownIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'M12 6H4l4 4.5z' })],
  );

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

const CheckIcon: FunctionalComponent = () =>
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
    [h('path', { d: 'm2.5 8.5 4 4 7-9' })],
  );

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <Menu.FilterProvider>
    <Menu.Root>
      <Menu.Trigger :class="styles.Trigger">
        Actions
        <CaretDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner :class="styles.Positioner" :side-offset="8" align="start">
          <Transition
            :enter-from-class="popupHiddenClass"
            :leave-to-class="popupHiddenClass"
            appear
          >
            <Menu.Popup :class="styles.Popup">
              <div :class="styles.InputContainer">
                <Menu.Input
                  :class="styles.Input"
                  aria-label="Filter actions"
                  placeholder="e.g. Save"
                />
                <Menu.Clear :class="styles.Clear">
                  <ClearIcon />
                </Menu.Clear>
              </div>
              <Menu.Empty :class="styles.Empty">No actions found.</Menu.Empty>
              <Menu.List :class="styles.List">
                <Menu.Group :class="styles.Section">
                  <Menu.GroupLabel :class="styles.GroupLabel">File</Menu.GroupLabel>
                  <Menu.Item :class="styles.Item">New file</Menu.Item>
                  <Menu.Item :class="styles.Item">Open file</Menu.Item>
                  <Menu.Item :class="styles.Item">Save</Menu.Item>
                  <Menu.Item :class="styles.Item">Save as</Menu.Item>
                  <Menu.Item :class="styles.Item">Duplicate</Menu.Item>
                  <Menu.Item :class="styles.Item">Rename</Menu.Item>
                </Menu.Group>
                <Menu.Group :class="styles.Section">
                  <Menu.GroupLabel :class="styles.GroupLabel">Organize</Menu.GroupLabel>
                  <FilterableSubmenu
                    label="Move to folder"
                    input-label="Filter folders"
                    placeholder="e.g. Projects"
                    empty-text="No folders found."
                    :options="folderOptions"
                  />
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger :class="styles.SubmenuTrigger">
                      Share
                      <CaretRightIcon />
                    </Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner
                        :class="styles.Positioner"
                        :side-offset="getSubmenuOffset"
                        :align-offset="getSubmenuOffset"
                      >
                        <Transition
                          :enter-from-class="popupHiddenClass"
                          :leave-to-class="popupHiddenClass"
                          appear
                        >
                          <Menu.Popup :class="styles.Popup">
                            <Menu.List :class="[styles.List, styles.SubmenuList]">
                              <Menu.Item
                                v-for="option in sharingOptions"
                                :key="option"
                                :class="styles.Item"
                              >
                                {{ option }}
                              </Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Transition>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                  <FilterableSubmenu
                    label="Export"
                    input-label="Filter export formats"
                    placeholder="e.g. PDF"
                    empty-text="No export formats found."
                    :options="exportOptions"
                  />
                  <Menu.Item :class="styles.Item">Download a copy</Menu.Item>
                  <Menu.Item :class="styles.Item">Delete</Menu.Item>
                </Menu.Group>

                <Menu.RadioGroup :class="styles.Section" default-value="date">
                  <Menu.Separator :class="styles.Separator" />
                  <Menu.GroupLabel :class="styles.GroupLabel">Sort by</Menu.GroupLabel>
                  <Menu.RadioItem
                    v-for="[value, label] in sortOptions"
                    :key="value"
                    :class="styles.ChoiceItem"
                    :value="value"
                    v-slot="{ state }"
                  >
                    <span v-if="state.checked" :class="styles.ChoiceIndicator">
                      <CheckIcon />
                    </span>
                    <span :class="styles.ChoiceText">{{ label }}</span>
                  </Menu.RadioItem>
                </Menu.RadioGroup>

                <Menu.Group :class="styles.Section">
                  <Menu.Separator :class="styles.Separator" />
                  <Menu.GroupLabel :class="styles.GroupLabel">View</Menu.GroupLabel>
                  <Menu.CheckboxItem :class="styles.ChoiceItem" default-checked v-slot="{ state }">
                    <span v-if="state.checked" :class="styles.ChoiceIndicator">
                      <CheckIcon />
                    </span>
                    <span :class="styles.ChoiceText">Show details</span>
                  </Menu.CheckboxItem>
                  <Menu.CheckboxItem :class="styles.ChoiceItem" v-slot="{ state }">
                    <span v-if="state.checked" :class="styles.ChoiceIndicator">
                      <CheckIcon />
                    </span>
                    <span :class="styles.ChoiceText">Show sidebar</span>
                  </Menu.CheckboxItem>
                  <Menu.CheckboxItem :class="styles.ChoiceItem" v-slot="{ state }">
                    <span v-if="state.checked" :class="styles.ChoiceIndicator">
                      <CheckIcon />
                    </span>
                    <span :class="styles.ChoiceText">Keep available offline</span>
                  </Menu.CheckboxItem>
                </Menu.Group>
              </Menu.List>
            </Menu.Popup>
          </Transition>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menu.FilterProvider>
</template>
