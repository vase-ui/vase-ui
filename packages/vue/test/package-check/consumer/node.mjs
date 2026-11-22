import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as vaseUi from '@vase-ui/vue';
import { Avatar } from '@vase-ui/vue/avatar';
import { MultiPart } from '@vase-ui/vue/multi-part';
import { ScriptedPart } from '@vase-ui/vue/scripted-part';
import { SinglePart } from '@vase-ui/vue/single-part';

assert.equal(vaseUi.SinglePart, SinglePart);
assert.equal(vaseUi.MultiPart, MultiPart);

const html = await renderToString(h(SinglePart, { orientation: 'vertical' }, () => 'text'));
assert.equal(html, '<div data-single-part data-orientation="vertical"><!--[-->text<!--]--></div>');

await assert.rejects(import('@vase-ui/vue/common/part-marker'));

const scriptedHtml = await renderToString(h(ScriptedPart));
assert.ok(scriptedHtml.includes('data-scripted-part-ran'), scriptedHtml);

const errors = [];
const imageWithNoRoot = createSSRApp({ render: () => h(Avatar.Image) });
imageWithNoRoot.config.errorHandler = (error) => errors.push(error.message);
await renderToString(imageWithNoRoot);
assert.deepEqual(errors, ['Vase UI error #3 ["Image"]: https://vase-ui.com/errors#3']);

// Vue checks props only in its development build, and `vue` reads NODE_ENV when it loads.
execFileSync(process.execPath, [fileURLToPath(new URL('development.mjs', import.meta.url))], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
});
