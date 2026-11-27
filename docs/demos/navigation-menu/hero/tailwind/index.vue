<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';

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

const base = import.meta.env.BASE_URL;

const overviewLinks = [
  {
    href: `${base}quick-start`,
    title: 'Quick Start',
    description: 'Install and assemble your first component.',
  },
  {
    href: `${base}releases#parity-with-base-ui`,
    title: 'Parity',
    description: 'See which components are complete and which are not started.',
  },
  {
    href: `${base}community#thanks`,
    title: 'Thanks',
    description: 'Meet the people whose work Vase UI carries.',
  },
  {
    href: base,
    title: 'About',
    description: 'Learn more about Vase UI and why it exists.',
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
    href: `${base}handbook/animation`,
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

const triggerClassName =
  'flex h-8 items-center justify-center gap-1.5 bg-transparent px-2 text-sm font-normal text-neutral-950 no-underline select-none min-[501px]:px-3 hover:bg-neutral-100 aria-expanded:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:text-white dark:hover:bg-neutral-800 dark:aria-expanded:bg-neutral-800';
const contentClassName =
  'h-full w-[calc(100vw-40px)] p-2 min-[500px]:w-max min-[500px]:max-w-[400px] ' +
  'transition-[opacity,transform,translate] duration-[var(--duration)] ease-[var(--easing)]';
const contentTransition = {
  enterFromClass:
    'opacity-0 data-[activation-direction=left]:translate-x-[-50%] data-[activation-direction=right]:translate-x-[50%]',
  leaveToClass:
    'opacity-0 data-[activation-direction=left]:translate-x-[50%] data-[activation-direction=right]:translate-x-[-50%]',
};
const linkCardClassName =
  'relative block h-full w-full border-0 bg-transparent p-2 text-left text-inherit no-underline hover:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:hover:bg-neutral-800';
</script>

<template>
  <NavigationMenu.Root class="min-w-max text-neutral-950 dark:text-white" aria-label="Example">
    <NavigationMenu.List class="relative flex gap-px">
      <NavigationMenu.Item>
        <NavigationMenu.Trigger :class="triggerClassName">
          Overview
          <NavigationMenu.Icon
            class="transition-transform duration-200 ease-[ease] data-popup-open:rotate-180"
          >
            <CaretDownIcon />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Content :class="contentClassName" :transition="contentTransition">
          <ul class="m-0 grid list-none grid-cols-2 p-0 max-[500px]:grid-cols-1">
            <li v-for="item in overviewLinks" :key="item.href">
              <!-- For the link of a router, see the custom links of the docs. -->
              <NavigationMenu.Link :class="linkCardClassName" :href="item.href">
                <h3 class="m-0 mb-1 text-sm leading-4 font-normal">{{ item.title }}</h3>
                <p class="m-0 text-sm text-neutral-500 dark:text-neutral-400">
                  {{ item.description }}
                </p>
              </NavigationMenu.Link>
            </li>
          </ul>
        </NavigationMenu.Content>
      </NavigationMenu.Item>

      <NavigationMenu.Item>
        <NavigationMenu.Trigger :class="triggerClassName">
          Handbook
          <NavigationMenu.Icon
            class="transition-transform duration-200 ease-[ease] data-popup-open:rotate-180"
          >
            <CaretDownIcon />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Content :class="contentClassName" :transition="contentTransition">
          <ul class="m-0 flex max-w-[400px] list-none flex-col justify-center p-0">
            <li v-for="item in handbookLinks" :key="item.href">
              <NavigationMenu.Link :class="linkCardClassName" :href="item.href">
                <h3 class="m-0 mb-1 text-sm leading-4 font-normal">{{ item.title }}</h3>
                <p class="m-0 text-sm text-neutral-500 dark:text-neutral-400">
                  {{ item.description }}
                </p>
              </NavigationMenu.Link>
            </li>
          </ul>
        </NavigationMenu.Content>
      </NavigationMenu.Item>

      <NavigationMenu.Item>
        <NavigationMenu.Link :class="triggerClassName" href="https://github.com/vase-ui/vase-ui">
          GitHub
        </NavigationMenu.Link>
      </NavigationMenu.Item>
    </NavigationMenu.List>

    <NavigationMenu.Portal>
      <NavigationMenu.Positioner
        class="h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom] duration-[var(--duration)] ease-[var(--easing)] before:absolute before:content-[''] data-instant:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0 data-[side=bottom]:before:h-2.5 data-[side=left]:before:top-0 data-[side=left]:before:right-[-10px] data-[side=left]:before:bottom-0 data-[side=left]:before:w-2.5 data-[side=right]:before:top-0 data-[side=right]:before:bottom-0 data-[side=right]:before:left-[-10px] data-[side=right]:before:w-2.5 data-[side=top]:before:right-0 data-[side=top]:before:bottom-[-10px] data-[side=top]:before:left-0 data-[side=top]:before:h-2.5"
        :side-offset="10"
        :collision-padding="{ top: 5, bottom: 5, left: 20, right: 20 }"
        :collision-avoidance="{ side: 'none' }"
        :style="{ '--duration': '0.35s', '--easing': 'cubic-bezier(0.22, 1, 0.36, 1)' }"
      >
        <Transition
          enter-from-class="scale-90 opacity-0"
          leave-to-class="scale-90 opacity-0 duration-150 ease-[ease]"
        >
          <NavigationMenu.Popup
            class="relative h-[var(--popup-height)] w-[var(--popup-width)] origin-[var(--transform-origin)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[opacity,transform,width,height,scale] duration-[var(--duration)] ease-[var(--easing)] dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
          >
            <NavigationMenu.Arrow
              class="relative block h-1.5 w-3 overflow-clip transition-[left,right] duration-[var(--duration)] ease-[var(--easing)] before:absolute before:bottom-0 before:left-1/2 before:block before:h-[calc(6px*sqrt(2))] before:w-[calc(6px*sqrt(2))] before:-translate-x-1/2 before:translate-y-1/2 before:rotate-45 before:border before:border-neutral-950 before:bg-white before:content-[''] data-[side=bottom]:top-[-6px] data-[side=left]:right-[-9px] data-[side=left]:rotate-90 data-[side=right]:left-[-9px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-6px] data-[side=top]:rotate-180 dark:before:border-white dark:before:bg-neutral-950"
            />
            <NavigationMenu.Viewport class="relative h-full w-full overflow-hidden" />
          </NavigationMenu.Popup>
        </Transition>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>
