import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { createRenderer, fieldsetDisabledTests } from '#test-utils';

const { render } = createRenderer();

fieldsetDisabledTests({
  render,
  part: (props, slots) => <AlertDialog.Trigger {...props} v-slots={slots} />,
  root: (children) => <AlertDialog.Root>{children}</AlertDialog.Root>,
});
