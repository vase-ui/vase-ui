<script setup lang="ts">
import { shallowRef } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import styles from '../../_index.module.css';

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

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <div :class="styles.Container">
    <Menu.Trigger :class="styles.Button" :handle="demoMenu" id="menu-trigger-1" payload="library">
      Library
    </Menu.Trigger>

    <Menu.Trigger :class="styles.Button" :handle="demoMenu" id="menu-trigger-2" payload="playback">
      Playback
    </Menu.Trigger>

    <Menu.Trigger :class="styles.Button" :handle="demoMenu" id="menu-trigger-3" payload="share">
      Share
    </Menu.Trigger>

    <button type="button" :class="styles.Button" @click="openPlayback">
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
      <Menu.Positioner :class="styles.Positioner" :side-offset="8" align="start">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <Menu.Popup :class="styles.Popup">
            <template v-if="payload">
              <Menu.Item
                v-for="item in itemGroups[payload]"
                :key="item.label"
                :class="styles.Item"
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
