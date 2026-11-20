<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import { Menubar } from '@vase-ui/vue/menubar';

function handleClick(event: MouseEvent) {
  if (event.currentTarget instanceof HTMLElement) {
    console.log(`${event.currentTarget.textContent} clicked`);
  }
}

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

const popupHiddenClass = 'scale-[0.98] opacity-0';
</script>

<template>
  <Menubar class="flex items-center">
    <Menu.Root>
      <Menu.Trigger
        class="h-8 border-0 bg-transparent px-3 font-[inherit] text-sm font-normal text-neutral-950 select-none data-pressed:bg-neutral-100 disabled:text-neutral-500 dark:text-white dark:focus-visible:bg-neutral-800 dark:data-pressed:bg-neutral-800 dark:disabled:text-neutral-400 focus-visible:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 focus-visible:relative dark:focus-visible:outline-white"
        >File</Menu.Trigger
      >
      <Menu.Portal>
        <Menu.Positioner class="outline-none" :side-offset="4">
          <Transition
            :enter-from-class="popupHiddenClass"
            :leave-to-class="popupHiddenClass"
            appear
          >
            <Menu.Popup
              class="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out data-instant:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            >
              <Menu.Item
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                @click="handleClick"
                >New</Menu.Item
              >
              <Menu.Item
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                @click="handleClick"
                >Open</Menu.Item
              >
              <Menu.Item
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                @click="handleClick"
                >Save</Menu.Item
              >

              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger
                  class="flex cursor-default items-center justify-between gap-4 py-2 pr-2 pl-4 text-sm leading-4 font-normal outline-none select-none data-popup-open:relative data-popup-open:z-0 data-popup-open:before:absolute data-popup-open:before:inset-x-1 data-popup-open:before:inset-y-0 data-popup-open:before:z-[-1] data-popup-open:before:bg-neutral-100 data-popup-open:before:content-[''] data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] data-highlighted:data-popup-open:before:bg-neutral-950 dark:data-popup-open:before:bg-neutral-800 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:data-highlighted:data-popup-open:before:bg-white"
                >
                  Export
                  <CaretRightIcon />
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner class="outline-none" :side-offset="-4" :align-offset="-4">
                    <Transition
                      :enter-from-class="popupHiddenClass"
                      :leave-to-class="popupHiddenClass"
                      appear
                    >
                      <Menu.Popup
                        class="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out data-instant:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
                      >
                        <Menu.Item
                          class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                          @click="handleClick"
                          >PDF</Menu.Item
                        >
                        <Menu.Item
                          class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                          @click="handleClick"
                          >PNG</Menu.Item
                        >
                        <Menu.Item
                          class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                          @click="handleClick"
                          >SVG</Menu.Item
                        >
                      </Menu.Popup>
                    </Transition>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>

              <Menu.Separator class="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
              <Menu.Item
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                @click="handleClick"
                >Print</Menu.Item
              >
            </Menu.Popup>
          </Transition>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>

    <Menu.Root>
      <Menu.Trigger
        class="h-8 border-0 bg-transparent px-3 font-[inherit] text-sm font-normal text-neutral-950 select-none data-pressed:bg-neutral-100 disabled:text-neutral-500 dark:text-white dark:focus-visible:bg-neutral-800 dark:data-pressed:bg-neutral-800 dark:disabled:text-neutral-400 focus-visible:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 focus-visible:relative dark:focus-visible:outline-white"
        >Edit</Menu.Trigger
      >
      <Menu.Portal>
        <Menu.Positioner class="outline-none" :side-offset="4">
          <Transition
            :enter-from-class="popupHiddenClass"
            :leave-to-class="popupHiddenClass"
            appear
          >
            <Menu.Popup
              class="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out data-instant:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            >
              <Menu.Item
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                @click="handleClick"
                >Cut</Menu.Item
              >
              <Menu.Item
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                @click="handleClick"
                >Copy</Menu.Item
              >
              <Menu.Item
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                @click="handleClick"
                >Paste</Menu.Item
              >
            </Menu.Popup>
          </Transition>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>

    <Menu.Root>
      <Menu.Trigger
        class="h-8 border-0 bg-transparent px-3 font-[inherit] text-sm font-normal text-neutral-950 select-none data-pressed:bg-neutral-100 disabled:text-neutral-500 dark:text-white dark:focus-visible:bg-neutral-800 dark:data-pressed:bg-neutral-800 dark:disabled:text-neutral-400 focus-visible:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 focus-visible:relative dark:focus-visible:outline-white"
        >View</Menu.Trigger
      >
      <Menu.Portal>
        <Menu.Positioner class="outline-none" :side-offset="4">
          <Transition
            :enter-from-class="popupHiddenClass"
            :leave-to-class="popupHiddenClass"
            appear
          >
            <Menu.Popup
              class="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out data-instant:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
            >
              <Menu.Item
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                @click="handleClick"
                >Zoom In</Menu.Item
              >
              <Menu.Item
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                @click="handleClick"
                >Zoom Out</Menu.Item
              >

              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger
                  class="flex cursor-default items-center justify-between gap-4 py-2 pr-2 pl-4 text-sm leading-4 font-normal outline-none select-none data-popup-open:relative data-popup-open:z-0 data-popup-open:before:absolute data-popup-open:before:inset-x-1 data-popup-open:before:inset-y-0 data-popup-open:before:z-[-1] data-popup-open:before:bg-neutral-100 data-popup-open:before:content-[''] data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] data-highlighted:data-popup-open:before:bg-neutral-950 dark:data-popup-open:before:bg-neutral-800 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white dark:data-highlighted:data-popup-open:before:bg-white"
                >
                  Layout
                  <CaretRightIcon />
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner class="outline-none" :side-offset="-4" :align-offset="-4">
                    <Transition
                      :enter-from-class="popupHiddenClass"
                      :leave-to-class="popupHiddenClass"
                      appear
                    >
                      <Menu.Popup
                        class="origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-none transition-[scale,opacity] duration-100 ease-out data-instant:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
                      >
                        <Menu.Item
                          class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                          @click="handleClick"
                          >Single Page</Menu.Item
                        >
                        <Menu.Item
                          class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                          @click="handleClick"
                          >Two Pages</Menu.Item
                        >
                        <Menu.Item
                          class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                          @click="handleClick"
                          >Continuous</Menu.Item
                        >
                      </Menu.Popup>
                    </Transition>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>

              <Menu.Separator class="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
              <Menu.Item
                class="flex cursor-default items-center justify-between gap-4 py-2 pr-4 pl-4 text-sm leading-4 font-normal outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                @click="handleClick"
                >Full Screen</Menu.Item
              >
            </Menu.Popup>
          </Transition>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>

    <Menu.Root disabled>
      <Menu.Trigger
        class="h-8 border-0 bg-transparent px-3 font-[inherit] text-sm font-normal text-neutral-950 select-none data-pressed:bg-neutral-100 disabled:text-neutral-500 dark:text-white dark:focus-visible:bg-neutral-800 dark:data-pressed:bg-neutral-800 dark:disabled:text-neutral-400 focus-visible:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 focus-visible:relative dark:focus-visible:outline-white"
        >Help</Menu.Trigger
      >
    </Menu.Root>
  </Menubar>
</template>
