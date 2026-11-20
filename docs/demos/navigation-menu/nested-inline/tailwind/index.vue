<script setup lang="ts">
import { h, onMounted, onUnmounted, ref } from 'vue';
import type { FunctionalComponent } from 'vue';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { audienceMenus, guideLinks, guidesPanel } from '../data';

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

const triggerClassName =
  'flex h-8 items-center justify-center gap-1.5 bg-transparent px-2 text-sm font-normal text-neutral-950 no-underline select-none min-[501px]:px-3 hover:bg-neutral-100 aria-expanded:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:text-white dark:hover:bg-neutral-800 dark:aria-expanded:bg-neutral-800';
const sharedContentClassName =
  'h-full w-[calc(100vw_-_40px)] ' +
  'transition-[opacity,translate] duration-[calc(var(--duration)*0.5),var(--duration)] ease-[ease,cubic-bezier(0.4,0,0.2,1)]';
const sharedContentTransition = {
  enterFromClass:
    'data-[activation-direction=left]:opacity-0 data-[activation-direction=right]:opacity-0 data-[activation-direction=left]:translate-x-[-2rem] data-[activation-direction=right]:translate-x-[2rem]',
  leaveToClass:
    'opacity-0 duration-[calc(var(--duration)*0.5)] ease-[ease] data-[activation-direction=left]:translate-x-[2rem] data-[activation-direction=right]:translate-x-[-2rem]',
};
const productContentClassName = `${sharedContentClassName} p-0 min-[700px]:[width:min(675px,calc(100vw-40px))]`;
const guidesContentClassName = `${sharedContentClassName} p-0 min-[700px]:[width:min(500px,calc(100vw-40px))]`;
const submenuTriggerClassName =
  'm-0 flex w-full min-w-[10rem] flex-col items-start gap-1 border-0 bg-transparent p-2 text-left text-inherit hover:bg-neutral-100 aria-expanded:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:hover:bg-neutral-800 dark:aria-expanded:bg-neutral-800';
const submenuContentClassName =
  'flex h-full translate-x-0 flex-col gap-4 p-4 min-[700px]:blur-0 transition-[opacity,translate,filter] duration-[var(--duration)] ease-[var(--easing)] min-[700px]:duration-[calc(var(--duration)*1.35)] min-[700px]:ease-[cubic-bezier(0.16,1,0.3,1)]';
const submenuContentTransition = {
  enterFromClass:
    'data-[activation-direction=left]:opacity-0 data-[activation-direction=right]:opacity-0 data-[activation-direction=left]:translate-x-[-50%] data-[activation-direction=right]:translate-x-[50%] min-[700px]:data-[activation-direction=up]:opacity-0 min-[700px]:data-[activation-direction=down]:opacity-0 min-[700px]:data-[activation-direction=up]:translate-y-[-72px] min-[700px]:data-[activation-direction=down]:translate-y-[72px] min-[700px]:blur-[2px]',
  leaveToClass:
    'opacity-0 data-[activation-direction=left]:translate-x-[50%] data-[activation-direction=right]:translate-x-[-50%] min-[700px]:data-[activation-direction=up]:translate-y-[72px] min-[700px]:data-[activation-direction=down]:translate-y-[-72px] min-[700px]:blur-[2px]',
};
const linkCardClassName =
  'relative block h-full w-full border-0 bg-transparent p-2 text-left text-inherit no-underline hover:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:hover:bg-neutral-800';
</script>

<template>
  <NavigationMenu.Root
    class="min-w-max text-neutral-950 dark:text-white"
    aria-label="Nested inline submenus"
  >
    <NavigationMenu.List class="relative flex gap-px">
      <NavigationMenu.Item>
        <NavigationMenu.Trigger :class="triggerClassName">
          Product
          <NavigationMenu.Icon
            class="transition-transform duration-200 ease-[ease] data-popup-open:rotate-180"
          >
            <CaretDownIcon />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Content
          :class="productContentClassName"
          :transition="sharedContentTransition"
        >
          <NavigationMenu.Root
            class="overflow-hidden overflow-clip text-neutral-950 dark:text-white"
            :orientation="isDesktop ? 'vertical' : 'horizontal'"
            default-value="developers"
          >
            <div
              class="grid grid-cols-1 overflow-hidden overflow-clip min-[700px]:grid-cols-[13rem_minmax(0,1fr)]"
            >
              <NavigationMenu.List
                class="m-0 flex list-none flex-row gap-1 overflow-x-auto p-2 min-[700px]:h-[var(--popup-height)] min-[700px]:flex-col min-[700px]:gap-px min-[700px]:overflow-x-visible min-[700px]:overflow-y-clip min-[700px]:border-r min-[700px]:border-r-neutral-950 min-[700px]:transition-[height] min-[700px]:duration-[var(--duration)] min-[700px]:ease-[var(--easing)] dark:min-[700px]:border-r-white"
              >
                <NavigationMenu.Item
                  v-for="menu in audienceMenus"
                  :key="menu.value"
                  :value="menu.value"
                >
                  <NavigationMenu.Trigger :class="submenuTriggerClassName">
                    <span class="text-sm leading-4 font-normal text-neutral-950 dark:text-white">{{
                      menu.label
                    }}</span>
                    <span class="text-sm text-neutral-500 dark:text-neutral-400">{{
                      menu.hint
                    }}</span>
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content
                    :class="submenuContentClassName"
                    :transition="submenuContentTransition"
                  >
                    <div>
                      <h4 class="m-0 text-base leading-5 font-normal">{{ menu.title }}</h4>
                      <p class="m-0 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        {{ menu.description }}
                      </p>
                    </div>
                    <ul class="-mx-2 m-0 flex list-none flex-col gap-0 p-0">
                      <li v-for="link in menu.links" :key="link.href">
                        <!-- For the link of a router, see the custom links of the docs. -->
                        <NavigationMenu.Link :class="linkCardClassName" :href="link.href">
                          <h5 class="m-0 text-sm leading-4 font-normal">{{ link.title }}</h5>
                          <p class="m-0 text-sm text-neutral-500 dark:text-neutral-400">
                            {{ link.description }}
                          </p>
                        </NavigationMenu.Link>
                      </li>
                    </ul>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport
                class="relative min-h-[16.5rem] overflow-hidden border-t border-neutral-950 min-[700px]:border-t-0 dark:border-white"
              />
            </div>
          </NavigationMenu.Root>
        </NavigationMenu.Content>
      </NavigationMenu.Item>

      <NavigationMenu.Item>
        <NavigationMenu.Trigger :class="triggerClassName">
          Learn
          <NavigationMenu.Icon
            class="transition-transform duration-200 ease-[ease] data-popup-open:rotate-180"
          >
            <CaretDownIcon />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Content
          :class="guidesContentClassName"
          :transition="sharedContentTransition"
        >
          <div class="flex flex-col gap-4 p-4 text-neutral-950 dark:text-white">
            <div>
              <h4 class="m-0 text-base leading-5 font-normal">{{ guidesPanel.title }}</h4>
              <p class="m-0 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {{ guidesPanel.description }}
              </p>
            </div>
            <ul class="-mx-2 m-0 flex list-none flex-col gap-0 p-0">
              <li v-for="link in guideLinks" :key="link.href">
                <NavigationMenu.Link :class="linkCardClassName" :href="link.href">
                  <h5 class="m-0 text-sm leading-4 font-normal">{{ link.title }}</h5>
                  <p class="m-0 text-sm text-neutral-500 dark:text-neutral-400">
                    {{ link.description }}
                  </p>
                </NavigationMenu.Link>
              </li>
            </ul>
          </div>
        </NavigationMenu.Content>
      </NavigationMenu.Item>

      <NavigationMenu.Item>
        <NavigationMenu.Link :class="triggerClassName" :href="`${base}parity`">
          Parity
        </NavigationMenu.Link>
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
          leave-to-class="scale-90 opacity-0 duration-150 ease-[ease] transition-[opacity,scale]"
          appear
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
