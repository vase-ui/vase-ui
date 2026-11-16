import { Collapsible } from '@vase-ui/vue/collapsible';
import { createRenderer, fieldsetDisabledTests } from '#test-utils';

const { render } = createRenderer();

fieldsetDisabledTests({
  render,
  part: (props, slots) => <Collapsible.Trigger {...props} v-slots={slots} />,
  root: (children) => <Collapsible.Root>{children}</Collapsible.Root>,
});
