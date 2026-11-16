import { Menu } from '@vase-ui/vue/menu';
import { createRenderer, fieldsetDisabledTests } from '#test-utils';

const { render } = createRenderer();

fieldsetDisabledTests({
  render,
  part: (props, slots) => <Menu.Trigger openOnHover delay={100} {...props} v-slots={slots} />,
  root: (children) => <Menu.Root>{children}</Menu.Root>,
  hover: true,
});
