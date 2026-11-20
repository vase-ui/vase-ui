import { PreviewCard } from '@vase-ui/vue/preview-card';
import { expectType } from '#test-utils';

const previewCard = PreviewCard.createHandle();

expectType<boolean, typeof previewCard.isOpen>(previewCard.isOpen);
