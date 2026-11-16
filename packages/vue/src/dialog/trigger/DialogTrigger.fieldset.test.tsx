import { Dialog } from '@vase-ui/vue/dialog';
import { createRenderer, fieldsetDisabledTests } from '#test-utils';

const { render } = createRenderer();

fieldsetDisabledTests({
  render,
  part: (props, slots) => <Dialog.Trigger {...props} v-slots={slots} />,
  root: (children) => <Dialog.Root>{children}</Dialog.Root>,
});
