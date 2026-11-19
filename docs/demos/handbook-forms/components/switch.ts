import { Switch as SwitchBase } from '@vase-ui/vue/switch';
import { withProps } from './withProps';

// The thumb is an element beside the switch. `peer-checked` moves it.
export const Switch = withProps(SwitchBase, {
  class:
    'peer m-0 h-5 w-9 shrink-0 appearance-none rounded-none border border-neutral-950 bg-white transition-colors duration-150 ease-[ease] checked:bg-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white dark:border-white dark:bg-neutral-950 dark:checked:bg-white',
});
