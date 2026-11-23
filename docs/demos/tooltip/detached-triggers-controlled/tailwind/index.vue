<script setup lang="ts">
import { shallowRef } from 'vue';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { HeadphonesIcon, StopwatchIcon, TrashIcon } from '../../icons-tw';

const demoTooltip = Tooltip.createHandle();

const open = shallowRef(false);
const triggerId = shallowRef<string | null>(null);

function handleOpenChange(isOpen: boolean, eventDetails: Tooltip.Root.ChangeEventDetails) {
  open.value = isOpen;
  triggerId.value = eventDetails.trigger?.id ?? null;
}

function openProgrammatically() {
  triggerId.value = 'trigger-2';
  open.value = true;
}

const iconButtonClass =
  'flex size-8 items-center justify-center border border-neutral-950 bg-white text-neutral-950 select-none data-popup-open:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white focus-visible:relative hover:bg-neutral-100 active:bg-neutral-200 dark:border-white dark:bg-neutral-950 dark:text-white dark:data-popup-open:bg-neutral-800 dark:hover:bg-neutral-800 dark:active:bg-neutral-700';
const buttonClass =
  'flex h-8 items-center justify-center gap-2 border border-neutral-950 bg-white px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white hover:bg-neutral-100 active:bg-neutral-200 dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:bg-neutral-800 dark:active:bg-neutral-700';
const popupClass =
  'relative flex flex-col border border-neutral-950 bg-white px-2 py-1 text-sm text-neutral-950 origin-[var(--transform-origin)] shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[transform,opacity] duration-100 ease-out data-instant:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none';
const popupHiddenClass = 'opacity-0 [transform:scale(0.98)]';
const arrowClass =
  "relative block w-3 h-1.5 overflow-clip data-[side=bottom]:top-[-6px] data-[side=left]:right-[-9px] data-[side=left]:rotate-90 data-[side=right]:left-[-9px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-6px] data-[side=top]:rotate-180 before:content-[''] before:absolute before:bottom-0 before:left-1/2 before:w-[calc(6px*sqrt(2))] before:h-[calc(6px*sqrt(2))] before:bg-white dark:before:bg-neutral-950 before:border before:border-neutral-950 dark:before:border-white before:[transform:translate(-50%,50%)_rotate(45deg)]";
</script>

<template>
  <Tooltip.Provider>
    <div class="flex gap-2 flex-wrap justify-center">
      <div class="flex">
        <Tooltip.Trigger
          :class="iconButtonClass"
          :handle="demoTooltip"
          id="trigger-1"
          aria-label="Trigger 1"
        >
          <HeadphonesIcon aria-hidden="true" />
        </Tooltip.Trigger>

        <Tooltip.Trigger
          :class="[iconButtonClass, 'border-l-0']"
          :handle="demoTooltip"
          id="trigger-2"
          aria-label="Trigger 2"
        >
          <StopwatchIcon aria-hidden="true" />
        </Tooltip.Trigger>

        <Tooltip.Trigger
          :class="[iconButtonClass, 'border-l-0']"
          :handle="demoTooltip"
          id="trigger-3"
          aria-label="Trigger 3"
        >
          <TrashIcon aria-hidden="true" />
        </Tooltip.Trigger>
      </div>

      <button type="button" :class="buttonClass" @click="openProgrammatically">
        Open programmatically
      </button>
    </div>

    <Tooltip.Root
      :handle="demoTooltip"
      :open="open"
      :trigger-id="triggerId"
      @open-change="handleOpenChange"
    >
      <Tooltip.Portal>
        <Tooltip.Positioner
          :side-offset="11"
          class="h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)]"
        >
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <Tooltip.Popup :class="popupClass">
              <Tooltip.Arrow :class="arrowClass" />
              Controlled tooltip
            </Tooltip.Popup>
          </Transition>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
</template>
