import { Collapsible } from '@vase-ui/vue/collapsible';
import { fieldsetDisabledTests } from '../../../test/fieldsetDisabledTests';

fieldsetDisabledTests({
  part: (props, slots) => <Collapsible.Trigger {...props} v-slots={slots} />,
  root: (children) => <Collapsible.Root>{children}</Collapsible.Root>,
});
