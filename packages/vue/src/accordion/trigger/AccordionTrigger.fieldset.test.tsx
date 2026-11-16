import { Accordion } from '@vase-ui/vue/accordion';
import { fieldsetDisabledTests } from '../../../test/fieldsetDisabledTests';

fieldsetDisabledTests({
  part: (props, slots) => (
    <Accordion.Item value={props['data-testid']}>
      <Accordion.Header>
        <Accordion.Trigger {...props} v-slots={slots} />
      </Accordion.Header>
    </Accordion.Item>
  ),
  root: (children) => <Accordion.Root>{children}</Accordion.Root>,
});
