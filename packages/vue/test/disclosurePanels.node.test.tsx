import { expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Accordion } from '@vase-ui/vue/accordion';
import { Collapsible } from '@vase-ui/vue/collapsible';
import { takeReportedMessages } from './reportedMessages';

it('renders searchable panels without a mount warning on the server', async () => {
  const html = await renderToString(
    <div>
      <Accordion.Root hiddenUntilFound keepMounted={false}>
        <Accordion.Item>
          <Accordion.Panel keepMounted={false}>Shipping times</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
      <Collapsible.Root>
        <Collapsible.Panel hiddenUntilFound keepMounted={false}>
          Details
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>,
  );
  expect(html).toContain('Shipping times');
  expect(html).toContain('Details');
  expect(takeReportedMessages()).toEqual([]);
});
