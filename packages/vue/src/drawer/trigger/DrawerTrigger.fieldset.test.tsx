import { Drawer } from '@vase-ui/vue/drawer';
import { createRenderer, fieldsetDisabledTests } from '#test-utils';

const { render } = createRenderer();

fieldsetDisabledTests({
  render,
  part: (props, slots) => <Drawer.Trigger {...props} v-slots={slots} />,
  root: (children) => <Drawer.Root>{children}</Drawer.Root>,
});
