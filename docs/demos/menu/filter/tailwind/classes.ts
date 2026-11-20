export const popupClass =
  'min-w-[max(14rem,var(--anchor-width))] origin-[var(--transform-origin)] overflow-hidden border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 transition-[scale,opacity] duration-100 ease-out outline-hidden dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none';
export const inputContainerClass =
  'flex items-center border-b border-neutral-300 has-data-highlighted:border-neutral-950 has-data-highlighted:ring-1 has-data-highlighted:ring-neutral-950 has-data-highlighted:ring-inset dark:border-neutral-700 dark:has-data-highlighted:border-white dark:has-data-highlighted:ring-white';
export const inputClass =
  'min-h-8 w-0 flex-1 bg-transparent px-2.5 text-sm any-pointer-coarse:text-base leading-none outline-hidden placeholder:text-neutral-500 dark:placeholder:text-neutral-400';
export const clearClass =
  'flex size-8 items-center justify-center bg-transparent outline-hidden focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white';
export const emptyClass = 'p-3 text-sm text-neutral-500 dark:text-neutral-400';
// Filtered groups stay mounted with `hidden`.
const listBaseClass =
  'overflow-y-auto py-1 outline-hidden scroll-py-1 not-has-[>:not([hidden])]:py-0';
export const listClass = `${listBaseClass} max-h-[min(22rem,var(--available-height))] [&>[data-filter-section]:not([hidden])~[data-filter-section]:not([hidden])>[data-filter-separator]]:block`;
export const submenuListClass = `${listBaseClass} max-h-[min(28rem,var(--available-height))]`;
const itemBaseClass =
  "cursor-default py-2 pl-4 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 data-highlighted:before:content-[''] dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white";
export const itemClass = `${itemBaseClass} flex pr-8`;
export const choiceItemClass = `${itemBaseClass} grid grid-cols-[1rem_1fr] items-center gap-2 pr-8 pl-2.5`;
export const submenuTriggerClass = `${itemBaseClass} flex items-center justify-between gap-4 pr-2 data-popup-open:relative data-popup-open:z-0 data-popup-open:before:absolute data-popup-open:before:inset-x-1 data-popup-open:before:inset-y-0 data-popup-open:before:z-[-1] data-popup-open:before:bg-neutral-100 data-popup-open:before:content-[''] data-highlighted:data-popup-open:before:bg-neutral-950 dark:data-popup-open:before:bg-neutral-800 dark:data-highlighted:data-popup-open:before:bg-white`;
export const groupLabelClass =
  'pt-1.5 pr-8 pb-1 pl-4 text-xs leading-4 font-medium text-neutral-500 select-none dark:text-neutral-400';
export const separatorClass = 'mx-1 my-1 hidden h-px bg-neutral-300 dark:bg-neutral-700';
