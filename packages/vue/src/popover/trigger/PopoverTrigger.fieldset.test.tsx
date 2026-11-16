import { Popover } from '@vase-ui/vue/popover';
import { createRenderer, fieldsetDisabledTests } from '#test-utils';

const { render } = createRenderer();

fieldsetDisabledTests({
  render,
  part: (props, slots) => <Popover.Trigger openOnHover delay={100} {...props} v-slots={slots} />,
  root: (children) => <Popover.Root>{children}</Popover.Root>,
  hover: true,
});
