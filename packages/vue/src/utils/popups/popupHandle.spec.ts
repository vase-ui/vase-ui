import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { expectType } from '#test-utils';

const tooltip = Tooltip.createHandle();
const alertDialog = AlertDialog.createHandle();

expectType<boolean, typeof tooltip.isOpen>(tooltip.isOpen);
expectType<boolean, typeof alertDialog.isOpen>(alertDialog.isOpen);
