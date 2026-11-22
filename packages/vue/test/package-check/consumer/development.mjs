import assert from 'node:assert/strict';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Avatar } from '@vase-ui/vue/avatar';
import { Select } from '@vase-ui/vue/select';
import { Tooltip } from '@vase-ui/vue/tooltip';

const warnings = [];
const app = createSSRApp({
  render: () =>
    h(Tooltip.Root, () => h(Select.Root, () => h(Tooltip.Trigger, { as: Select.Trigger }))),
});
app.config.warnHandler = (message) => warnings.push(message);

const html = await renderToString(app);
assert.ok(html.includes('aria-haspopup="listbox"'), html);
assert.deepEqual(warnings, []);

const errors = [];
const imageWithNoRoot = createSSRApp({ render: () => h(Avatar.Image) });
imageWithNoRoot.config.errorHandler = (error) => errors.push(error.message);
// After the setup throws, Vue warns that the component has no render function.
imageWithNoRoot.config.warnHandler = () => {};
await renderToString(imageWithNoRoot);
assert.deepEqual(errors, ['Vase UI Avatar: <Avatar.Image> must be inside <Avatar.Root>.']);
