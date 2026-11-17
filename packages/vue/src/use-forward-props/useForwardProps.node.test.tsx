import { expect, it, vi } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Accordion } from '../accordion';
import WrapperForward from '../internals/WrapperForward.test.vue';

it('forwards on a server', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const html = await renderToString(
    createSSRApp({
      render: () => (
        <Accordion.Root keepMounted>
          <Accordion.Item>
            <WrapperForward>Kept content</WrapperForward>
          </Accordion.Item>
        </Accordion.Root>
      ),
    }),
  );
  expect(html).toContain('Kept content');
  expect(warning).not.toHaveBeenCalled();
});
