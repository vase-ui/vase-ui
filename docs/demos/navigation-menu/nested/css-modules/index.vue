<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import styles from './index.module.css';

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

const base = import.meta.env.BASE_URL;

const overviewLinks = [
  {
    href: `${base}quick-start`,
    title: 'Quick Start',
    description: 'Install and assemble your first component.',
  },
  {
    href: `${base}parity`,
    title: 'Parity',
    description: 'See which components are complete and which are not started.',
  },
  {
    href: `${base}thanks`,
    title: 'Thanks',
    description: 'Meet the people whose work Vase UI carries.',
  },
] as const;

const handbookLinks = [
  {
    href: `${base}handbook/styling`,
    title: 'Styling',
    description:
      'Vase UI components can be styled with plain CSS, CSS Modules, or utility classes.',
  },
  {
    href: `${base}components/navigation-menu#closing-animations`,
    title: 'Animation',
    description:
      'Vase UI components can be animated with CSS transitions, CSS animations, or JavaScript.',
  },
  {
    href: `${base}handbook/composition`,
    title: 'Composition',
    description: 'Vase UI components can be replaced and composed with your own components.',
  },
] as const;
</script>

<template>
  <NavigationMenu.Root :class="styles.Root">
    <NavigationMenu.List :class="styles.List">
      <NavigationMenu.Item>
        <NavigationMenu.Trigger :class="styles.Trigger">
          Overview
          <NavigationMenu.Icon :class="styles.Icon">
            <CaretDownIcon />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Content :class="styles.Content">
          <ul :class="styles.GridLinkList">
            <li v-for="item in overviewLinks" :key="item.href">
              <!-- To use the link of a router, such as RouterLink, give it to `as`. -->
              <NavigationMenu.Link :class="styles.LinkCard" :href="item.href">
                <h3 :class="styles.LinkTitle">{{ item.title }}</h3>
                <p :class="styles.LinkDescription">{{ item.description }}</p>
              </NavigationMenu.Link>
            </li>
            <li>
              <NavigationMenu.Root orientation="vertical">
                <NavigationMenu.List>
                  <NavigationMenu.Item>
                    <NavigationMenu.Trigger :class="styles.LinkCard">
                      <span :class="styles.LinkTitle">Handbook</span>
                      <p :class="styles.LinkDescription">How to use Vase UI effectively.</p>
                      <NavigationMenu.Icon :class="styles.NestedIcon">
                        <CaretRightIcon />
                      </NavigationMenu.Icon>
                    </NavigationMenu.Trigger>
                    <NavigationMenu.Content :class="styles.Content">
                      <ul :class="styles.FlexLinkList">
                        <li v-for="item in handbookLinks" :key="item.href">
                          <NavigationMenu.Link :class="styles.LinkCard" :href="item.href">
                            <h3 :class="styles.LinkTitle">{{ item.title }}</h3>
                            <p :class="styles.LinkDescription">{{ item.description }}</p>
                          </NavigationMenu.Link>
                        </li>
                      </ul>
                    </NavigationMenu.Content>
                  </NavigationMenu.Item>
                </NavigationMenu.List>

                <NavigationMenu.Portal>
                  <NavigationMenu.Positioner
                    :class="styles.Positioner"
                    :side-offset="8"
                    :align-offset="-8"
                    align="end"
                    side="right"
                  >
                    <NavigationMenu.Popup :class="styles.Popup">
                      <NavigationMenu.Viewport :class="styles.Viewport" />
                    </NavigationMenu.Popup>
                  </NavigationMenu.Positioner>
                </NavigationMenu.Portal>
              </NavigationMenu.Root>
            </li>
          </ul>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>

    <NavigationMenu.Portal>
      <NavigationMenu.Positioner
        :class="styles.Positioner"
        :side-offset="10"
        :collision-padding="{ top: 5, bottom: 5, left: 20, right: 20 }"
      >
        <NavigationMenu.Popup :class="styles.Popup">
          <NavigationMenu.Arrow :class="styles.Arrow" />
          <NavigationMenu.Viewport :class="styles.Viewport" />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>
