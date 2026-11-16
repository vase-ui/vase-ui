import { Accordion } from '@vase-ui/vue/accordion';
import { createRenderer, fieldsetDisabledTests } from '#test-utils';

const { render } = createRenderer();

fieldsetDisabledTests({
  render,
  part: (props, slots) => (
    <Accordion.Item value={props['data-testid']}>
      <Accordion.Header>
        <Accordion.Trigger {...props} v-slots={slots} />
      </Accordion.Header>
    </Accordion.Item>
  ),
  root: (children) => <Accordion.Root>{children}</Accordion.Root>,
});
