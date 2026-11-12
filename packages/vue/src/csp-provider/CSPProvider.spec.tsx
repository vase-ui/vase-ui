import { CSPProvider } from '@vase-ui/vue/csp-provider';
import type { CSPProviderProps, CSPProviderState } from '@vase-ui/vue/csp-provider';
import { expectType } from '#test-utils';

<CSPProvider />;
<CSPProvider nonce="test-nonce" />;
<CSPProvider disableStyleElements />;
<CSPProvider nonce="test-nonce" disableStyleElements>
  <div />
</CSPProvider>;
<CSPProvider v-slots={{ default: () => <div /> }} />;

// @ts-expect-error `nonce` must be a string.
<CSPProvider nonce={1} />;

export const props: CSPProvider.Props = { nonce: 'test-nonce', disableStyleElements: true };
export const state: CSPProvider.State = {};

expectType<CSPProviderProps, typeof props>(props);
expectType<CSPProviderState, typeof state>(state);
