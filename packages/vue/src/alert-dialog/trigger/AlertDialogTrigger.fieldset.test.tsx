import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { fieldsetDisabledTests } from '../../../test/fieldsetDisabledTests';

fieldsetDisabledTests({
  part: (props, slots) => <AlertDialog.Trigger {...props} v-slots={slots} />,
  root: (children) => <AlertDialog.Root>{children}</AlertDialog.Root>,
});
