import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { withProps } from './withProps';

export const Root = Autocomplete.Root;

export const Input = withProps(Autocomplete.Input, {
  class:
    'h-8 w-[16rem] border border-neutral-950 bg-white px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white md:w-[20rem] dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400',
});

export const Portal = Autocomplete.Portal;

export const Positioner = withProps(Autocomplete.Positioner, {
  class: 'outline-none data-empty:hidden',
  sideOffset: 4,
});

export const Popup = withProps(Autocomplete.Popup, {
  class:
    'w-(--anchor-width) max-w-(--available-width) border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none',
});

export const List = withProps(Autocomplete.List, {
  class:
    'max-h-[min(22.5rem,var(--available-height))] overflow-y-auto overscroll-contain py-1 scroll-py-1 outline-0 data-empty:p-0',
});

export const Item = withProps(Autocomplete.Item, {
  class:
    'flex cursor-default flex-col gap-0.25 py-2 pr-8 pl-2 text-sm leading-4 outline-none select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white',
});
