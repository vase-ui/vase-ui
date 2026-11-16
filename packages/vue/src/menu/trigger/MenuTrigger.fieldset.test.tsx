import { Menu } from '@vase-ui/vue/menu';
import { fieldsetDisabledTests } from '../../../test/fieldsetDisabledTests';

fieldsetDisabledTests({
  part: (props, slots) => <Menu.Trigger openOnHover delay={100} {...props} v-slots={slots} />,
  root: (children) => <Menu.Root>{children}</Menu.Root>,
  hover: true,
});
