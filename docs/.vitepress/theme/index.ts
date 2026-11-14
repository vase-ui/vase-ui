/// <reference lib="esnext.temporal" />
// `vitepress/theme` also puts the Inter font in the build, and the site does not use that font.
import DefaultTheme from 'vitepress/theme-without-fonts';
import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/geist-mono';
// A browser that has no `Temporal` gets the polyfill, with all its calendars. The line above gives
// the samples and the demos the global types of `Temporal`.
import 'temporal-polyfill/full/global';
import './tokens.css';
import './look.css';

export default DefaultTheme;
