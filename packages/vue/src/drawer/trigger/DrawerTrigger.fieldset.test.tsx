import { Drawer } from '@vase-ui/vue/drawer';
import { fieldsetDisabledTests } from '../../../test/fieldsetDisabledTests';

fieldsetDisabledTests({
  part: (props, slots) => <Drawer.Trigger {...props} v-slots={slots} />,
  root: (children) => <Drawer.Root>{children}</Drawer.Root>,
});
