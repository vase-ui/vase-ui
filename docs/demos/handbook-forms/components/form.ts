import { Form as VaseForm } from '@vase-ui/vue/form';
import { withProps } from './withProps';

export const Form = withProps(VaseForm, {
  class: 'flex w-full max-w-3xs flex-col gap-5 sm:max-w-[20rem]',
});
