<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';

type MenuContent = {
  heading: string;
  groups: string[][];
};

const MENUS = {
  library: {
    heading: 'Library',
    groups: [
      ['Add to library', 'Add to favorites'],
      ['Create playlist', 'Create station'],
    ],
  },
  playback: {
    heading: 'Playback',
    groups: [
      ['Play now', 'Add to queue'],
      ['Play next', 'Play last', 'Sleep timer'],
    ],
  },
  share: {
    heading: 'Share',
    groups: [
      ['Copy link', 'Copy embed code'],
      ['Share to contacts', 'Share to social'],
    ],
  },
} as const satisfies Record<string, MenuContent>;

type MenuKey = keyof typeof MENUS;

const demoMenu = Menu.createHandle<MenuKey>();

const triggerClass = `
  flex h-8 items-center justify-center
  rounded-none border border-neutral-950 bg-white
  px-3 text-sm font-normal text-neutral-950
  select-none
  hover:bg-neutral-100 active:bg-neutral-200 data-pressed:bg-neutral-100
  dark:border-white dark:bg-neutral-950 dark:text-white
  dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:data-pressed:bg-neutral-800
  focus-visible:outline focus-visible:outline-2
  focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white
`;
const itemClass = `
  flex cursor-default py-2 pr-8 pl-4
  text-sm leading-4 outline-none select-none
  data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white
  data-highlighted:before:absolute data-highlighted:before:inset-x-1
  data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1]
  data-highlighted:before:bg-neutral-950 data-highlighted:before:content-['']
  dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white
`;

const popupHiddenClass = 'scale-90 opacity-0';
// The viewport has the side of the new trigger in `data-activation-direction`.
const contentEnterFromClass =
  'opacity-0 group-data-[activation-direction~=left]:-translate-x-1/2 group-data-[activation-direction~=right]:translate-x-1/2';
const contentLeavingClass = 'absolute top-0 left-0';
const contentLeaveToClass =
  'opacity-0 group-data-[activation-direction~=left]:translate-x-1/2 group-data-[activation-direction~=right]:-translate-x-1/2';
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <Menu.Trigger :class="triggerClass" :handle="demoMenu" payload="library">Library</Menu.Trigger>
    <Menu.Trigger :class="triggerClass" :handle="demoMenu" payload="playback">
      Playback
    </Menu.Trigger>
    <Menu.Trigger :class="triggerClass" :handle="demoMenu" payload="share">Share</Menu.Trigger>

    <Menu.Root v-slot="{ payload }" :handle="demoMenu" :modal="false">
      <Menu.Portal>
        <Menu.Positioner
          :side-offset="8"
          align="start"
          class="outline-none h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom,transform] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none"
        >
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <Menu.Popup
              class="relative h-[var(--popup-height,auto)] w-[var(--popup-width,auto)] py-1 origin-[var(--transform-origin)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[width,height,opacity,scale] duration-[0.35s] ease-[cubic-bezier(0.22,1,0.36,1)] data-instant:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            >
              <Menu.Viewport
                v-slot="{ triggerId }"
                class="group relative h-full w-full overflow-clip p-0"
              >
                <Transition
                  :enter-from-class="contentEnterFromClass"
                  :leave-active-class="contentLeavingClass"
                  :leave-to-class="contentLeaveToClass"
                >
                  <div
                    :key="triggerId ?? ''"
                    class="w-[var(--popup-width)] transition-[translate,opacity] duration-[350ms,175ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                  >
                    <template v-if="payload">
                      <template
                        v-for="(group, groupIndex) in MENUS[payload].groups"
                        :key="groupIndex"
                      >
                        <Menu.Group>
                          <Menu.GroupLabel
                            v-if="groupIndex === 0"
                            class="px-4 py-2 text-sm leading-4 text-neutral-500 select-none dark:text-neutral-400"
                          >
                            {{ MENUS[payload].heading }}
                          </Menu.GroupLabel>
                          <Menu.Item v-for="item in group" :key="item" :class="itemClass">
                            {{ item }}
                          </Menu.Item>
                        </Menu.Group>
                        <Menu.Separator
                          v-if="groupIndex < MENUS[payload].groups.length - 1"
                          class="mx-1 my-1 h-px bg-neutral-950 dark:bg-white"
                        />
                      </template>
                    </template>
                  </div>
                </Transition>
              </Menu.Viewport>
            </Menu.Popup>
          </Transition>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </div>
</template>
