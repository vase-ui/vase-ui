<script setup lang="ts">
import { h, shallowRef } from 'vue';
import type { FunctionalComponent } from 'vue';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Menu } from '@vase-ui/vue/menu';

const dialogOpen = shallowRef(false);
const backdropHiddenClass = 'opacity-0';
const menuPopupHiddenClass = 'scale-[0.98] opacity-0';
const dialogPopupHiddenClass = 'scale-[0.98] opacity-0';

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

const buttonClass =
  'flex h-8 items-center justify-center gap-1.5 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-disabled:bg-neutral-100 active:not-disabled:bg-neutral-200 data-pressed:bg-neutral-100 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-disabled:bg-neutral-800 dark:active:not-disabled:bg-neutral-700 dark:data-pressed:bg-neutral-800 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white';

const itemClass =
  "flex cursor-default py-2 pr-8 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white";
</script>

<template>
  <Menu.Root>
    <Menu.Trigger :class="buttonClass">
      Playlist
      <CaretDownIcon />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner class="outline-hidden" :side-offset="8" align="start">
        <Transition :enter-from-class="menuPopupHiddenClass" :leave-to-class="menuPopupHiddenClass">
          <Menu.Popup
            class="relative origin-[var(--transform-origin)] border border-neutral-950 bg-white py-1 text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 outline-hidden transition-[scale,opacity] duration-100 ease-out dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
          >
            <Menu.Item :class="itemClass">Play</Menu.Item>
            <Menu.Item :class="itemClass">Share</Menu.Item>
            <Menu.Separator class="mx-1 my-1 h-px bg-neutral-950 dark:bg-white" />
            <Menu.Item :class="itemClass" @click="dialogOpen = true">Delete…</Menu.Item>
          </Menu.Popup>
        </Transition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>

  <AlertDialog.Root v-model:open="dialogOpen">
    <AlertDialog.Portal>
      <Transition :enter-from-class="backdropHiddenClass" :leave-to-class="backdropHiddenClass">
        <AlertDialog.Backdrop
          class="fixed inset-0 bg-black/20 dark:bg-black/50 transition-opacity duration-150 supports-[-webkit-touch-callout:none]:absolute supports-[-webkit-touch-callout:none]:min-h-dvh"
        />
      </Transition>
      <Transition
        :enter-from-class="dialogPopupHiddenClass"
        :leave-to-class="dialogPopupHiddenClass"
      >
        <AlertDialog.Popup
          class="fixed top-1/2 left-1/2 -mt-8 flex w-96 max-w-[calc(100%-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 bg-white dark:bg-neutral-950 p-4 text-neutral-950 dark:text-white border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[scale,opacity] duration-100 ease-out"
        >
          <div class="flex flex-col gap-1">
            <AlertDialog.Title class="text-base font-bold">Delete playlist?</AlertDialog.Title>
            <AlertDialog.Description class="text-sm text-neutral-600 dark:text-neutral-400">
              You can't undo this action.
            </AlertDialog.Description>
          </div>
          <div class="flex justify-end gap-3">
            <AlertDialog.Close :class="buttonClass">Cancel</AlertDialog.Close>
            <AlertDialog.Close :class="[buttonClass, 'text-red-700 dark:text-red-400']"
              >Delete</AlertDialog.Close
            >
          </div>
        </AlertDialog.Popup>
      </Transition>
    </AlertDialog.Portal>
  </AlertDialog.Root>
</template>
