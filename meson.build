project('warp-quicksettings', 'c', version: '1', meson_version: '>= 0.63.3')

gnome = import('gnome')
fs = import('fs')

app_id = 'org.gnome.Shell.Extensions.WarpQuickSettings'
app_path = '/org/gnome/Shell/Extensions/WarpQuickSettings'
extuuid = 'warpswitcher@pikokr.dev'

extdatadir = join_paths(fs.expanduser('~/.local/share/gnome-shell'), 'extensions', extuuid)

# gnome.compile_resources(
#   app_id,
#   app_id + '.gresource.xml',
#   gresource_bundle: true,
#   install_dir: extdatadir,
#   install: true
# )

install_subdir(
  'src',
  install_dir: extdatadir,
  strip_directory: true
)
