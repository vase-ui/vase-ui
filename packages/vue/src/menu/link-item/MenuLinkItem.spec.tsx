import { Menu } from '@vase-ui/vue/menu';

// `Menu.LinkItem` accepts the native `<a>` props.
<Menu.LinkItem href="/home" target="_blank" rel="noopener" download />;

// @ts-expect-error - `href` is a string
<Menu.LinkItem href={1} />;
