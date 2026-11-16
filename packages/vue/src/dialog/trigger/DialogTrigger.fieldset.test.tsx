import { Dialog } from '@vase-ui/vue/dialog';
import { fieldsetDisabledTests } from '../../../test/fieldsetDisabledTests';

fieldsetDisabledTests({
  part: (props, slots) => <Dialog.Trigger {...props} v-slots={slots} />,
  root: (children) => <Dialog.Root>{children}</Dialog.Root>,
});
