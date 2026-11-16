import assert from 'node:assert/strict';
import { test } from 'node:test';

test('the site configuration of the development server turns off the page cache of VitePress', async () => {
  process.env.NODE_ENV = 'development';
  const { default: config } = await import('../../docs/.vitepress/config.ts');
  assert.equal(config.markdown?.cache, false);
});
