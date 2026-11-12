import MultiPartItem from './item/MultiPartItem.vue';
import type { MultiPartItemProps } from './item/MultiPartItem.vue';
import MultiPartRoot from './root/MultiPartRoot.vue';
import type { MultiPartRootProps } from './root/MultiPartRoot.vue';

export const Root: typeof MultiPartRoot = MultiPartRoot;
export namespace Root {
  export type Props<Payload = unknown> = MultiPartRootProps<Payload>;
}

export const Item: typeof MultiPartItem = MultiPartItem;
export namespace Item {
  export type Props = MultiPartItemProps;
}
