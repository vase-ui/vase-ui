import { CheckboxGroup as VaseCheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { withProps } from './withProps';

export const CheckboxGroup = withProps(VaseCheckboxGroup, {
  class: 'flex flex-col items-start gap-1 text-neutral-950 dark:text-white',
});
