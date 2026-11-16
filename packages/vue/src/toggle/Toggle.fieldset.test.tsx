import { Toggle } from '@vase-ui/vue/toggle';
import { fieldsetDisabledTests } from '../../test/fieldsetDisabledTests';

fieldsetDisabledTests({
  part: (props, slots) => <Toggle {...props} v-slots={slots} />,
  root: (children) => children,
});
