import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as vaseUi from '@vase-ui/vue';
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

// Vue checks props only in its development build, and `vue` reads NODE_ENV when it loads.
execFileSync(process.execPath, [fileURLToPath(new URL('development.mjs', import.meta.url))], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
});
