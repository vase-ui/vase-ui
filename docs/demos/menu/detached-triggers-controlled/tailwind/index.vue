<script setup lang="ts">
import { shallowRef } from 'vue';
import { Menu } from '@vase-ui/vue/menu';

const itemGroups = {
  library: [
    { label: 'Add to library', onClick: () => console.log('Adding to library') },
    { label: 'Add to favorites', onClick: () => console.log('Adding to favorites') },
  ],
  playback: [
    { label: 'Play', onClick: () => console.log('Playing') },
    { label: 'Add to queue', onClick: () => console.log('Adding to queue') },
  ],
  share: [
    { label: 'Share', onClick: () => console.log('Sharing') },
    { label: 'Copy link', onClick: () => console.log('Copying link') },
  ],
} as const;

type MenuKey = keyof typeof itemGroups;

const demoMenu = Menu.createHandle<MenuKey>();

const open = shallowRef(false);
const activeTrigger = shallowRef<string | null>(null);

function handleOpenChange(isOpen: boolean, eventDetails: Menu.Root.ChangeEventDetails) {
  open.value = isOpen;
  if (isOpen) {
    activeTrigger.value = eventDetails.trigger?.id ?? null;
  }
}

function openPlayback() {
  activeTrigger.value = 'menu-trigger-2';
  open.value = true;
}

const itemClass =
  "flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] aria-disabled:text-neutral-500 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:aria-disabled:text-neutral-400";
const triggerClass =
  'flex h-8 items-center justify-center gap-2 rounded-none border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white active:bg-neutral-200 data-pressed:bg-neutral-100 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:data-pressed:bg-neutral-800';
const popupClass =
  'relative origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-hidden transition-[scale,opacity] duration-100 ease-out dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none';

const popupHiddenClass = 'scale-[0.98] opacity-0';
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <Menu.Trigger :class="triggerClass" :handle="demoMenu" id="menu-trigger-1" payload="library">
      Library
    </Menu.Trigger>

    <Menu.Trigger :class="triggerClass" :handle="demoMenu" id="menu-trigger-2" payload="playback">
      Playback
    </Menu.Trigger>

    <Menu.Trigger :class="triggerClass" :handle="demoMenu" id="menu-trigger-3" payload="share">
      Share
    </Menu.Trigger>

    <button type="button" :class="triggerClass" @click="openPlayback">
      Open playback (controlled)
    </button>
  </div>

  <Menu.Root
    v-slot="{ payload }"
    :handle="demoMenu"
    :open="open"
    :trigger-id="activeTrigger"
    @open-change="handleOpenChange"
  >
    <Menu.Portal>
      <Menu.Positioner class="outline-hidden" :side-offset="8" align="start">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
          <Menu.Popup :class="popupClass">
            <template v-if="payload">
              <Menu.Item
                v-for="item in itemGroups[payload]"
                :key="item.label"
                :class="itemClass"
                @click="item.onClick"
              >
                {{ item.label }}
              </Menu.Item>
            </template>
          </Menu.Popup>
        </Transition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
