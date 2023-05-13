#!/bin/bash

# Delete existing copy of the extension
rm -rf ~/.local/share/gnome-shell/extensions/cloudflare-warp-toggle@khaled.is-a.dev
mkdir -p ~/.local/share/gnome-shell/extensions/cloudflare-warp-toggle@khaled.is-a.dev

#Copy extension source to the directory
cp -a "src/." ~/.local/share/gnome-shell/extensions/cloudflare-warp-toggle@khaled.is-a.dev

echo "Please restart gnome shell"
