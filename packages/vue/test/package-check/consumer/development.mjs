import assert from 'node:assert/strict';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Select } from '@vase-ui/vue/select';
import { Toolbar } from '@vase-ui/vue/toolbar';

const warnings = [];
const app = createSSRApp({
  render: () =>
    h(Toolbar.Root, () => h(Select.Root, () => h(Toolbar.Button, { as: Select.Trigger }))),
});
app.config.warnHandler = (message) => warnings.push(message);

const html = await renderToString(app);
assert.ok(html.includes('aria-haspopup="listbox"'), html);
assert.deepEqual(warnings, []);
