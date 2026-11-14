import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { expectType } from '#test-utils';

const tooltip = Tooltip.createHandle();
const previewCard = PreviewCard.createHandle();
const alertDialog = AlertDialog.createHandle();

expectType<boolean, typeof tooltip.isOpen>(tooltip.isOpen);
expectType<boolean, typeof previewCard.isOpen>(previewCard.isOpen);
expectType<boolean, typeof alertDialog.isOpen>(alertDialog.isOpen);
