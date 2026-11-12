import assert from 'node:assert/strict';
import { h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import * as vaseUi from '@vase-ui/vue';
import { MultiPart } from '@vase-ui/vue/multi-part';
import { SinglePart } from '@vase-ui/vue/single-part';

assert.equal(vaseUi.SinglePart, SinglePart);
assert.equal(vaseUi.MultiPart, MultiPart);

const html = await renderToString(h(SinglePart, { orientation: 'vertical' }, () => 'text'));
assert.equal(html, '<div data-single-part data-orientation="vertical"><!--[-->text<!--]--></div>');

await assert.rejects(import('@vase-ui/vue/internals/part-marker'));
