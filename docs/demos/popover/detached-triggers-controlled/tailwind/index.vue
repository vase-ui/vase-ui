<script setup lang="ts">
import { h, shallowRef } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Popover } from '@vase-ui/vue/popover';

const demoPopover = Popover.createHandle();

const open = shallowRef(false);
const triggerId = shallowRef<string | null>(null);

function handleOpenChange(isOpen: boolean, eventDetails: Popover.Root.ChangeEventDetails) {
  open.value = isOpen;
  triggerId.value = eventDetails.trigger?.id ?? null;
}

function openProgrammatically() {
  triggerId.value = 'trigger-2';
  open.value = true;
}

const XIcon: FunctionalComponent = (_, { attrs }) =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      ...attrs,
      style: { display: 'block' },
    },
    [h('path', { d: 'm4.5 4.5 7 7m-7 0 7-7' })],
  );

const triggerClassName =
  'flex h-8 items-center justify-center border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm font-normal whitespace-nowrap text-neutral-950 dark:text-white select-none hover:not-disabled:bg-neutral-100 dark:hover:not-disabled:bg-neutral-800 active:not-disabled:bg-neutral-200 dark:active:not-disabled:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 data-pressed:bg-neutral-100 dark:data-pressed:bg-neutral-800 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white';

const popupHiddenClass = 'scale-[0.98] opacity-0';
</script>

<template>
  <div class="flex gap-2 flex-wrap justify-center">
    <Popover.Trigger :class="triggerClassName" :handle="demoPopover" id="trigger-1">
      Trigger 1
    </Popover.Trigger>

    <Popover.Trigger :class="triggerClassName" :handle="demoPopover" id="trigger-2">
      Trigger 2
    </Popover.Trigger>

    <Popover.Trigger :class="triggerClassName" :handle="demoPopover" id="trigger-3">
      Trigger 3
    </Popover.Trigger>

    <button
      type="button"
      class="flex h-8 items-center justify-center border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm font-normal whitespace-nowrap text-neutral-950 dark:text-white select-none hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
      @click="openProgrammatically"
    >
      Open programmatically
    </button>
  </div>

  <Popover.Root
    :handle="demoPopover"
    :open="open"
    :trigger-id="triggerId"
    @open-change="handleOpenChange"
  >
    <Popover.Portal>
      <Popover.Positioner
        class="h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)]"
        :side-offset="8"
      >
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
          <Popover.Popup
            class="relative flex h-[var(--popup-height,auto)] w-[var(--popup-width,auto)] max-w-[500px] flex-col gap-1 origin-[var(--transform-origin)] bg-white dark:bg-neutral-950 p-3 text-neutral-950 dark:text-white outline-none border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[scale,opacity] duration-100 ease-out"
          >
            <Popover.Arrow
              class="relative block w-3 h-1.5 overflow-clip data-[side=bottom]:top-[-6px] data-[side=left]:right-[-9px] data-[side=left]:rotate-90 data-[side=right]:left-[-9px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-6px] data-[side=top]:rotate-180 before:content-[''] before:absolute before:bottom-0 before:left-1/2 before:w-[calc(6px*sqrt(2))] before:h-[calc(6px*sqrt(2))] before:bg-white dark:before:bg-neutral-950 before:border before:border-neutral-950 dark:before:border-white before:[transform:translate(-50%,50%)_rotate(45deg)]"
            />
            <Popover.Title class="pr-8 text-sm font-bold">Free shipping</Popover.Title>
            <Popover.Description class="text-sm text-neutral-600 dark:text-neutral-400">
              Orders over $50 arrive in 3–5 business days at no extra cost.
            </Popover.Description>
            <a
              href="#"
              class="self-start text-sm text-neutral-950 dark:text-white underline underline-offset-[0.16em] decoration-[1px] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
              >View shipping policy</a
            >
            <Popover.Close
              aria-label="Close"
              class="absolute top-2 right-2 flex size-7 items-center justify-center border-0 bg-transparent p-0 text-neutral-950 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
            >
              <XIcon />
            </Popover.Close>
          </Popover.Popup>
        </Transition>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
