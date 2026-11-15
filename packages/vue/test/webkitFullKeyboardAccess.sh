#!/bin/sh
# Starts the WebKit of Playwright with full keyboard access, the setting of macOS that puts each
# control in the order of the Tab key. macOS reads the setting `AppleKeyboardUIMode` from the
# arguments of a process, and the value 2 turns it on. Playwright refuses an argument that does not
# start with `-`, so this script adds the value.
exec "$VASE_UI_WEBKIT_EXECUTABLE" "$@" -AppleKeyboardUIMode 2
