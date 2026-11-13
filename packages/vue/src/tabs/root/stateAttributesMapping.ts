import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { TabsRootState } from './TabsRoot.vue';
import * as TabsRootDataAttributes from './TabsRootDataAttributes';

export const tabsStateAttributesMapping: StateAttributesMapping<TabsRootState> = {
  tabActivationDirection: (dir) => ({
    [TabsRootDataAttributes.activationDirection]: dir,
  }),
};
