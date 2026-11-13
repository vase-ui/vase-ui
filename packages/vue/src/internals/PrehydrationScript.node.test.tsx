import { describe, expect, it } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import PrehydrationScriptPart, {
  PREHYDRATION_SCRIPT_PART_SCRIPT,
} from '../../test/fixtures/PrehydrationScriptPart.vue';

describe('PrehydrationScript on a server', () => {
  it('renders the script with its text after the element of the part', async () => {
    const html = await renderToString(createSSRApp(PrehydrationScriptPart));

    expect(html).toContain(
      `<span data-testid="element" hidden data-allow-mismatch="attribute"></span><script>${PREHYDRATION_SCRIPT_PART_SCRIPT}</script>`,
    );
  });

  it('gives the script the nonce of CSPProvider', async () => {
    const html = await renderToString(
      createSSRApp(PrehydrationScriptPart, { nonce: 'test-nonce' }),
    );

    expect(html).toContain('<script nonce="test-nonce">');
  });
});
