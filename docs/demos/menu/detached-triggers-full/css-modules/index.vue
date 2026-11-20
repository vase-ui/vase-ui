<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
import styles from '../../_index.module.css';
import transitionStyles from './index.module.css';

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

const popupHiddenClass = transitionStyles.PopupHidden;
const contentEnterFromClass = transitionStyles.ContentEnterFrom;
const contentLeavingClass = transitionStyles.ContentLeaving;
const contentLeaveToClass = transitionStyles.ContentLeaveTo;
</script>

<template>
  <div :class="styles.Container">
    <Menu.Trigger :class="styles.Button" :handle="demoMenu" payload="library">Library</Menu.Trigger>
    <Menu.Trigger :class="styles.Button" :handle="demoMenu" payload="playback">
      Playback
    </Menu.Trigger>
    <Menu.Trigger :class="styles.Button" :handle="demoMenu" payload="share">Share</Menu.Trigger>

    <Menu.Root v-slot="{ payload }" :handle="demoMenu" :modal="false">
      <Menu.Portal>
        <Menu.Positioner
          :side-offset="8"
          align="start"
          :class="[styles.Positioner, transitionStyles.Positioner]"
        >
          <Transition
            :enter-from-class="popupHiddenClass"
            :leave-to-class="popupHiddenClass"
            appear
          >
            <Menu.Popup :class="[styles.Popup, transitionStyles.Popup]">
              <Menu.Viewport v-slot="{ triggerId }" :class="transitionStyles.Viewport">
                <Transition
                  :enter-from-class="contentEnterFromClass"
                  :leave-active-class="contentLeavingClass"
                  :leave-to-class="contentLeaveToClass"
                >
                  <div :key="triggerId ?? ''" :class="transitionStyles.Content">
                    <template v-if="payload">
                      <template
                        v-for="(group, groupIndex) in MENUS[payload].groups"
                        :key="groupIndex"
                      >
                        <Menu.Group>
                          <Menu.GroupLabel v-if="groupIndex === 0" :class="styles.Label">
                            {{ MENUS[payload].heading }}
                          </Menu.GroupLabel>
                          <Menu.Item v-for="item in group" :key="item" :class="styles.Item">
                            {{ item }}
                          </Menu.Item>
                        </Menu.Group>
                        <Menu.Separator
                          v-if="groupIndex < MENUS[payload].groups.length - 1"
                          :class="styles.Separator"
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
