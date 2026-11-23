<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import {
  choiceItemClass,
  clearClass,
  emptyClass,
  groupLabelClass,
  inputClass,
  inputContainerClass,
  itemClass,
  listClass,
  popupClass,
  separatorClass,
  submenuListClass,
  submenuTriggerClass,
} from './classes';
import FilterableSubmenu from './FilterableSubmenu.vue';

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

const popupHiddenClass = 'scale-[0.98] opacity-0';
</script>

<template>
  <Menu.FilterProvider>
    <Menu.Root>
      <Menu.Trigger
        class="flex h-8 items-center justify-center gap-1.5 rounded-none border border-neutral-950 bg-white pr-2 pl-3 text-sm leading-none font-normal whitespace-nowrap text-neutral-950 select-none hover:not-disabled:bg-neutral-100 active:not-disabled:bg-neutral-200 data-pressed:bg-neutral-100 disabled:border-neutral-500 disabled:text-neutral-500 focus-visible:-outline-offset-1 focus-visible:outline-2 focus-visible:outline-neutral-950 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:active:not-disabled:bg-neutral-700 dark:data-pressed:bg-neutral-800 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 dark:focus-visible:outline-white"
      >
        Actions
        <CaretDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner class="outline-hidden" :side-offset="8" align="start">
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <Menu.Popup :class="popupClass">
              <div :class="inputContainerClass">
                <Menu.Input
                  :class="inputClass"
                  aria-label="Filter actions"
                  placeholder="e.g. Save"
                />
                <Menu.Clear :class="clearClass">
                  <ClearIcon />
                </Menu.Clear>
              </div>
              <Menu.Empty :class="emptyClass">No actions found.</Menu.Empty>
              <Menu.List :class="listClass">
                <Menu.Group data-filter-section>
                  <Menu.GroupLabel :class="groupLabelClass">File</Menu.GroupLabel>
                  <Menu.Item :class="itemClass">New file</Menu.Item>
                  <Menu.Item :class="itemClass">Open file</Menu.Item>
                  <Menu.Item :class="itemClass">Save</Menu.Item>
                  <Menu.Item :class="itemClass">Save as</Menu.Item>
                  <Menu.Item :class="itemClass">Duplicate</Menu.Item>
                  <Menu.Item :class="itemClass">Rename</Menu.Item>
                </Menu.Group>
                <Menu.Group data-filter-section>
                  <Menu.GroupLabel :class="groupLabelClass">Organize</Menu.GroupLabel>
                  <FilterableSubmenu
                    label="Move to folder"
                    input-label="Filter folders"
                    placeholder="e.g. Projects"
                    empty-text="No folders found."
                    :options="folderOptions"
                  />
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger :class="submenuTriggerClass">
                      Share
                      <CaretRightIcon />
                    </Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner
                        class="outline-hidden"
                        :side-offset="getSubmenuOffset"
                        :align-offset="getSubmenuOffset"
                      >
                        <Transition
                          :enter-from-class="popupHiddenClass"
                          :leave-to-class="popupHiddenClass"
                        >
                          <Menu.Popup :class="popupClass">
                            <Menu.List :class="submenuListClass">
                              <Menu.Item
                                v-for="option in sharingOptions"
                                :key="option"
                                :class="itemClass"
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
                  <Menu.Item :class="itemClass">Download a copy</Menu.Item>
                  <Menu.Item :class="itemClass">Delete</Menu.Item>
                </Menu.Group>

                <Menu.RadioGroup data-filter-section default-value="date">
                  <Menu.Separator data-filter-separator :class="separatorClass" />
                  <Menu.GroupLabel :class="groupLabelClass">Sort by</Menu.GroupLabel>
                  <Menu.RadioItem
                    v-for="[value, label] in sortOptions"
                    :key="value"
                    :class="choiceItemClass"
                    :value="value"
                    v-slot="{ state }"
                  >
                    <span v-if="state.checked" class="col-start-1">
                      <CheckIcon />
                    </span>
                    <span class="col-start-2 min-w-0">{{ label }}</span>
                  </Menu.RadioItem>
                </Menu.RadioGroup>

                <Menu.Group data-filter-section>
                  <Menu.Separator data-filter-separator :class="separatorClass" />
                  <Menu.GroupLabel :class="groupLabelClass">View</Menu.GroupLabel>
                  <Menu.CheckboxItem :class="choiceItemClass" default-checked v-slot="{ state }">
                    <span v-if="state.checked" class="col-start-1">
                      <CheckIcon />
                    </span>
                    <span class="col-start-2 min-w-0">Show details</span>
                  </Menu.CheckboxItem>
                  <Menu.CheckboxItem :class="choiceItemClass" v-slot="{ state }">
                    <span v-if="state.checked" class="col-start-1">
                      <CheckIcon />
                    </span>
                    <span class="col-start-2 min-w-0">Show sidebar</span>
                  </Menu.CheckboxItem>
                  <Menu.CheckboxItem :class="choiceItemClass" v-slot="{ state }">
                    <span v-if="state.checked" class="col-start-1">
                      <CheckIcon />
                    </span>
                    <span class="col-start-2 min-w-0">Keep available offline</span>
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
