import { Select } from '@vase-ui/vue/select';
import { withProps } from './withProps';

export const Root = Select.Root;

export const Label = withProps(Select.Label, {
  class: 'cursor-default text-sm font-bold text-neutral-950 dark:text-white',
});

export const Trigger = withProps(Select.Trigger, {
  class:
    'flex h-8 min-w-40 cursor-default items-center justify-between gap-3 border border-neutral-950 bg-white pl-2 pr-1 text-sm font-normal text-neutral-950 select-none hover:enabled:bg-neutral-100 active:enabled:bg-neutral-200 disabled:border-neutral-500 disabled:text-neutral-500 data-pressed:bg-neutral-100 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:enabled:bg-neutral-800 dark:active:enabled:bg-neutral-700 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400 dark:data-pressed:bg-neutral-800',
});

export const Value = withProps(Select.Value, {
  class: 'data-placeholder:text-neutral-500 dark:data-placeholder:text-neutral-400',
});

export const Icon = Select.Icon;

export const Portal = Select.Portal;

export const Positioner = withProps(Select.Positioner, {
  class: 'outline-none select-none z-10',
  sideOffset: 4,
});

export const Popup = withProps(Select.Popup, {
  class:
    'group min-w-(--anchor-width) origin-(--transform-origin) border border-neutral-950 bg-white bg-clip-padding text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out data-[side=none]:min-w-[calc(var(--anchor-width)+1.75rem)] data-[side=none]:translate-y-px data-[side=none]:scale-100 data-[side=none]:opacity-100 data-[side=none]:transition-none dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none',
});

export const ScrollUpArrow = withProps(Select.ScrollUpArrow, {
  class:
    "top-0 z-1 flex h-4 w-full cursor-default items-center justify-center bg-white text-center text-xs before:absolute data-[side=none]:before:-top-full before:left-0 before:h-full before:w-full before:content-[''] dark:bg-neutral-950",
});

export const ScrollDownArrow = withProps(Select.ScrollDownArrow, {
  class:
    "bottom-0 z-1 flex h-4 w-full cursor-default items-center justify-center bg-white text-center text-xs before:absolute before:left-0 before:h-full before:w-full before:content-[''] data-[side=none]:before:-bottom-full dark:bg-neutral-950",
});

export const List = withProps(Select.List, {
  class: 'relative max-h-(--available-height) overflow-y-auto py-1 scroll-py-6',
});

export const Item = withProps(Select.Item, {
  class:
    'grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 py-1.5 pr-4 pl-2.5 text-sm outline-none select-none group-data-[side=none]:pr-12 data-highlighted:bg-neutral-950 data-highlighted:text-white dark:data-highlighted:bg-white dark:data-highlighted:text-neutral-950',
});

export const ItemText = withProps(Select.ItemText, { class: 'col-start-2' });
