import { RadioGroup as VaseRadioGroup } from '@vase-ui/vue/radio-group';
import { withProps } from './withProps';

export const RadioGroup = withProps(VaseRadioGroup, {
  class: 'flex w-full flex-row items-start gap-1 text-neutral-950 dark:text-white',
});
