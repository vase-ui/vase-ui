import { Drawer } from '@vase-ui/vue/drawer';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { expectType } from '#test-utils';

const tooltip = Tooltip.createHandle();
const previewCard = PreviewCard.createHandle();
const drawer = Drawer.createHandle();

expectType<boolean, typeof tooltip.isOpen>(tooltip.isOpen);
expectType<boolean, typeof previewCard.isOpen>(previewCard.isOpen);
expectType<boolean, typeof drawer.isOpen>(drawer.isOpen);
