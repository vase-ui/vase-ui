<script setup lang="ts">
import { h, onMounted, onUnmounted, ref } from 'vue';
import type { FunctionalComponent } from 'vue';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { audienceMenus, guideLinks, guidesPanel } from '../data';
import styles from './index.module.css';

const transition = { enterFromClass: styles.EnterFrom, leaveToClass: styles.LeaveTo };

const base = import.meta.env.BASE_URL;
const isDesktop = ref(true);
let desktopQuery: MediaQueryList | undefined;
function updateDesktop() {
  isDesktop.value = desktopQuery?.matches ?? true;
}
onMounted(() => {
  desktopQuery = window.matchMedia('(min-width: 700px)');
  updateDesktop();
  desktopQuery.addEventListener('change', updateDesktop);
});
onUnmounted(() => desktopQuery?.removeEventListener('change', updateDesktop));

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
</script>

<template>
  <NavigationMenu.Root :class="styles.Root" aria-label="Nested inline submenus">
    <NavigationMenu.List :class="styles.List">
      <NavigationMenu.Item>
        <NavigationMenu.Trigger :class="styles.Trigger">
          Product
          <NavigationMenu.Icon :class="styles.Icon">
            <CaretDownIcon />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Content
          :class="[styles.Content, styles.ProductContent]"
          :transition="transition"
        >
          <NavigationMenu.Root
            :class="styles.SubmenuRoot"
            :orientation="isDesktop ? 'vertical' : 'horizontal'"
            default-value="developers"
          >
            <div :class="styles.SubmenuLayout">
              <NavigationMenu.List :class="styles.SubmenuList">
                <NavigationMenu.Item
                  v-for="menu in audienceMenus"
                  :key="menu.value"
                  :value="menu.value"
                >
                  <NavigationMenu.Trigger :class="styles.SubmenuTrigger">
                    <span :class="styles.SubmenuLabel">{{ menu.label }}</span>
                    <span :class="styles.SubmenuHint">{{ menu.hint }}</span>
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content :class="styles.SubmenuContent" :transition="transition">
                    <div>
                      <h4 :class="styles.SubmenuTitle">{{ menu.title }}</h4>
                      <p :class="styles.SubmenuDescription">{{ menu.description }}</p>
                    </div>
                    <ul :class="styles.LinkList">
                      <li v-for="link in menu.links" :key="link.href">
                        <!-- For the link of a router, see the custom links of the docs. -->
                        <NavigationMenu.Link :class="styles.LinkCard" :href="link.href">
                          <h5 :class="styles.LinkTitle">{{ link.title }}</h5>
                          <p :class="styles.LinkDescription">{{ link.description }}</p>
                        </NavigationMenu.Link>
                      </li>
                    </ul>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport :class="styles.SubmenuViewport" />
            </div>
          </NavigationMenu.Root>
        </NavigationMenu.Content>
      </NavigationMenu.Item>

      <NavigationMenu.Item>
        <NavigationMenu.Trigger :class="styles.Trigger">
          Learn
          <NavigationMenu.Icon :class="styles.Icon">
            <CaretDownIcon />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Content
          :class="[styles.Content, styles.GuidesContent]"
          :transition="transition"
        >
          <div :class="styles.GuidesPanel">
            <div>
              <h4 :class="styles.SubmenuTitle">{{ guidesPanel.title }}</h4>
              <p :class="styles.SubmenuDescription">{{ guidesPanel.description }}</p>
            </div>
            <ul :class="styles.LinkList">
              <li v-for="link in guideLinks" :key="link.href">
                <NavigationMenu.Link :class="styles.LinkCard" :href="link.href">
                  <h5 :class="styles.LinkTitle">{{ link.title }}</h5>
                  <p :class="styles.LinkDescription">{{ link.description }}</p>
                </NavigationMenu.Link>
              </li>
            </ul>
          </div>
        </NavigationMenu.Content>
      </NavigationMenu.Item>

      <NavigationMenu.Item>
        <NavigationMenu.Link :class="styles.Trigger" :href="`${base}parity`">
          Parity
        </NavigationMenu.Link>
      </NavigationMenu.Item>

      <NavigationMenu.Item>
        <NavigationMenu.Link :class="styles.Trigger" href="https://github.com/vase-ui/vase-ui">
          GitHub
        </NavigationMenu.Link>
      </NavigationMenu.Item>
    </NavigationMenu.List>

    <NavigationMenu.Portal>
      <NavigationMenu.Positioner
        :class="styles.Positioner"
        :side-offset="10"
        :collision-padding="{ top: 5, bottom: 5, left: 20, right: 20 }"
        :collision-avoidance="{ side: 'none' }"
      >
        <Transition :enter-from-class="styles.EnterFrom" :leave-to-class="styles.LeaveTo" appear>
          <NavigationMenu.Popup :class="styles.Popup">
            <NavigationMenu.Arrow :class="styles.Arrow" />
            <NavigationMenu.Viewport :class="styles.Viewport" />
          </NavigationMenu.Popup>
        </Transition>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>
