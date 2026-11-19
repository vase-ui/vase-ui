import { Input as InputBase } from '@vase-ui/vue/input';
import { withProps } from './withProps';

export const Input = withProps(InputBase, {
  class:
    'h-8 w-full max-w-xs border border-neutral-950 bg-white px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-400',
});
