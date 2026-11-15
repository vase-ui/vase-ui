import { Button as VaseButton } from '@vase-ui/vue/button';
import { withProps } from './withProps';

export const Button = withProps(VaseButton, {
  type: 'button',
  class:
    'flex h-8 items-center justify-center gap-2 rounded-none border border-neutral-950 bg-white px-3 py-0 font-[inherit] text-sm leading-none whitespace-nowrap font-normal text-neutral-950 select-none hover:not-data-disabled:bg-neutral-100 active:not-data-disabled:bg-neutral-200 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:not-data-disabled:bg-neutral-800 dark:active:not-data-disabled:bg-neutral-700 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 dark:disabled:border-neutral-400 dark:disabled:text-neutral-400',
});
