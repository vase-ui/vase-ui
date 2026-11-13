import { Toolbar } from '@vase-ui/vue/toolbar';

export const nativeAttributes = (
  <Toolbar.Input
    autocomplete="off"
    type="search"
    placeholder="Search"
    defaultValue="a"
    onInput={(event) => event.preventVaseUIHandler()}
  />
);
