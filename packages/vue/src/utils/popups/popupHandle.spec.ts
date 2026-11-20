import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { expectType } from '#test-utils';

const previewCard = PreviewCard.createHandle();
const alertDialog = AlertDialog.createHandle();

expectType<boolean, typeof previewCard.isOpen>(previewCard.isOpen);
expectType<boolean, typeof alertDialog.isOpen>(alertDialog.isOpen);
