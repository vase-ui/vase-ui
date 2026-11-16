import { Toggle } from '@vase-ui/vue/toggle';
import { createRenderer, fieldsetDisabledTests } from '#test-utils';

const { render } = createRenderer();

fieldsetDisabledTests({
  render,
  part: (props, slots) => <Toggle {...props} v-slots={slots} />,
  root: (children) => children,
});
