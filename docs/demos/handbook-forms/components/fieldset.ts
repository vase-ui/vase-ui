import { Fieldset } from '@vase-ui/vue/fieldset';
import { withProps } from './withProps';

export const Root = Fieldset.Root;

export const Legend = withProps(Fieldset.Legend, {
  class: 'text-sm font-bold text-neutral-950 dark:text-white',
});
