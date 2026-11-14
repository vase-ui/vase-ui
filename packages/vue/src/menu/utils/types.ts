import type { MenuRootChangeEventReason } from '../root/MenuRoot.vue';

export interface MenuOpenEventDetails {
  open: boolean;
  reason: MenuRootChangeEventReason | null;
  nodeId: string | undefined;
  parentNodeId: string | null;
}
