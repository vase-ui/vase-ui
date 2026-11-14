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

const overviewLinks = [
  {
    href: '/react/overview/quick-start',
    title: 'Quick Start',
    description: 'Install and assemble your first component.',
  },
  {
    href: '/react/overview/accessibility',
    title: 'Accessibility',
    description: 'Learn how we build accessible components.',
  },
  {
    href: '/react/overview/releases',
    title: 'Releases',
    description: 'See what’s new in the latest Base UI versions.',
  },
  {
    href: '/react/overview/about',
    title: 'About',
    description: 'Learn more about Base UI and our mission.',
  },
] as const;

const handbookLinks = [
  {
    href: '/react/handbook/styling',
    title: 'Styling',
    description:
      'Base UI components can be styled with plain CSS, Tailwind CSS, CSS-in-JS, or CSS Modules.',
  },
  {
    href: '/react/handbook/animation',
    title: 'Animation',
    description:
      'Base UI components can be animated with CSS transitions, CSS animations, or JavaScript libraries.',
  },
  {
    href: '/react/handbook/composition',
    title: 'Composition',
    description:
      'Base UI components can be replaced and composed with your own existing components.',
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
          </ul>
        </NavigationMenu.Content>
      </NavigationMenu.Item>

      <NavigationMenu.Item>
        <NavigationMenu.Trigger :class="styles.Trigger">
          Handbook
          <NavigationMenu.Icon :class="styles.Icon">
            <CaretDownIcon />
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

      <NavigationMenu.Item>
        <NavigationMenu.Link :class="styles.Trigger" href="https://github.com/mui/base-ui">
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
        <NavigationMenu.Popup :class="styles.Popup">
          <NavigationMenu.Arrow :class="styles.Arrow" />
          <NavigationMenu.Viewport :class="styles.Viewport" />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>
