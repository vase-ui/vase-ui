import { Popover } from '@vase-ui/vue/popover';
import { fieldsetDisabledTests } from '../../../test/fieldsetDisabledTests';

fieldsetDisabledTests({
  part: (props, slots) => <Popover.Trigger openOnHover delay={100} {...props} v-slots={slots} />,
  root: (children) => <Popover.Root>{children}</Popover.Root>,
  hover: true,
});
