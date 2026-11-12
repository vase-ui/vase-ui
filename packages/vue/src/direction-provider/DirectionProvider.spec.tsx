import type { ComputedRef } from 'vue';
import { expectType } from '#test-utils';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type {
  useDirection,
  DirectionProviderProps,
  DirectionProviderState,
  TextDirection,
} from '@vase-ui/vue/direction-provider';

const direction = null as unknown as ReturnType<typeof useDirection>;

expectType<ComputedRef<TextDirection>, typeof direction>(direction);

const props: DirectionProviderProps = {
  direction: 'rtl',
};

expectType<TextDirection | undefined, typeof props.direction>(props.direction);

const namespaceProps = null as unknown as DirectionProvider.Props;
const namespaceState = null as unknown as DirectionProvider.State;

expectType<DirectionProviderProps, typeof namespaceProps>(namespaceProps);
expectType<DirectionProviderState, typeof namespaceState>(namespaceState);

<DirectionProvider />;
<DirectionProvider direction="ltr" />;
<DirectionProvider direction="rtl" />;

const invalidDirection = (
  // @ts-expect-error Only ltr and rtl are supported directions.
  <DirectionProvider direction="vertical" />
);
