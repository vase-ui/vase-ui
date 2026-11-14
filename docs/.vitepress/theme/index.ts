// `vitepress/theme` also puts the Inter font in the build, and the site does not use that font.
import DefaultTheme from 'vitepress/theme-without-fonts';
import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/geist-mono';
import './tokens.css';
import './look.css';

export default DefaultTheme;
