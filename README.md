# Clean Uniform Neat Torrent

Clean Uniform Neat Torrent is a desktop BitTorrent client for Windows and Linux. It is built on Electron with a React renderer, and all torrent work happens in the main process through webtorrent, wrapped in Effect services. The app is meant to be installed: settings, the saved session and caches live in the per-user application data folder, and new torrents are saved to the system Downloads folder unless another folder is chosen.

## Setup

The project needs Node.js 22 or newer and pnpm 10. After cloning the repository, run `pnpm install`. The install step also rebuilds the native uTP module for the bundled Electron version, which takes about a minute on the first run and needs a working C++ toolchain only when no prebuilt binary is available for the platform.

## Development

`pnpm dev` starts electron-vite with hot reload for the renderer and automatic restarts for the main process and preload. One environment detail matters here: the integrated terminal of VS Code exports `ELECTRON_RUN_AS_NODE=1`, which makes the Electron binary behave like plain Node and fail on startup with errors about unknown options. In such a terminal, start the app with `env -u ELECTRON_RUN_AS_NODE pnpm dev` in Git Bash, or clear the variable first with `Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell.

The dev command is a small Effect CLI in `scripts/dev.ts` that validates its flags before electron-vite starts. `pnpm dev --list=test` replaces the real torrent engine with six in-memory fixtures, one for each state the list can show: a finished download that is not seeding, a seeding torrent, a stalled download, a download that cycles from empty to complete every five seconds, a paused download and a torrent still waiting for metadata. `pnpm dev --list=3` loads only the first three of them, and any other value stops the script with the help text. In fixture mode nothing touches the network, the disk or `session.json`, so the real session is left as it was; pausing, resuming, removing, selecting files and adding magnets all work in memory. Production builds ignore the flag.

Before moving on from a change, run `pnpm typecheck`, which checks the main and renderer projects separately, and `pnpm lint`, which verifies Prettier formatting. `pnpm format` rewrites files into the expected style. The project has no ESLint configuration on purpose; strict TypeScript settings carry most of that load.

## Building

`pnpm dist` type-checks the sources, bundles them with electron-vite and packages the result with electron-builder for the current platform, without publishing anything. `pnpm dist:win` produces an NSIS installer in `dist/`, and `pnpm dist:linux` produces an AppImage and a deb package; the Linux targets are best built on Linux or in CI. A full Windows build takes about two minutes once the Electron and NSIS downloads are cached.

The installer is assisted rather than one-click: it installs per user without administrator rights, lets the user pick the installation folder, and creates desktop and Start Menu shortcuts. Uninstalling keeps the application data, so a reinstall restores settings and the torrent list. Both the installer and the Linux packages register the app as the handler for `magnet:` links and `.torrent` files.

## Releasing

Releases are published to GitHub Releases of `piscopancer/clean-uniform-neat-torrent`, and the installed app updates itself from there. To cut a release, raise `version` in `package.json`, export a GitHub token with the `repo` scope as `GH_TOKEN`, and run `pnpm release` on each platform that should receive artifacts. electron-builder uploads the installers together with the `latest.yml` and `latest-linux.yml` metadata that electron-updater reads.

The installed app checks for updates ten seconds after launch and then every four hours. An update downloads in the background, and once it is ready a toast offers to restart; ignoring it is fine, because the update is also applied the next time the app quits. The Settings dialog shows the current update state and has a button for a manual check.

## Windows SmartScreen

The builds are not code-signed, so on first launch of the installer Windows SmartScreen shows a warning that the publisher is unknown. Choosing "More info" and then "Run anyway" starts the installer. The warning disappears only with a code-signing certificate that has built up reputation, which is outside the scope of this project; once a certificate is available, it can be configured through the standard `CSC_LINK` and `CSC_KEY_PASSWORD` variables of electron-builder without code changes.

## Architecture

The main process owns all state. Its services are Effect layers composed in `src/main/runtime.ts` into one `ManagedRuntime`, which is created after Electron is ready and disposed when the app quits. Disposal runs the finalizers of every service, so the session is written one last time and the webtorrent client is destroyed before the process exits. IPC handlers in `src/main/ipc` are thin: they decode the input with the command's Schema, call a service, and encode either the result or a tagged error. The renderer has no Node access and no Effect runtime; it talks to main through a small typed bridge exposed by the preload, keeps its state in Zustand stores, and maps each error tag to its own toast.

```
 renderer (React, Zustand)                      main process
 ─────────────────────────                      ────────────────────────────────────────────
  components ─ lib/api ── preload bridge ──▶ ipc/register ─▶ ipc/handlers
                    ▲                                            │
                    │ push events                                ▼
                    └──────────── Broadcaster ◀── Bridge ◀── TorrentService ──▶ TorrentClient (webtorrent)
                                       ▲                    │      │
                                       │                    │      └──▶ SessionStore (session.json)
                                       │                    ▼
                                       └──────────── UpdateService   SettingsService (settings.json)
                                                     (electron-updater)

  index.ts ─ single-instance lock, launch-args queue, window.ts (close to tray), tray.ts
```

Shared contracts live in `src/shared`: Schemas for torrents, settings and update status, the tagged errors, and the IPC contract that types both sides of the bridge. Settings and the session file are decoded with the same Schemas when they are read, so a damaged or outdated file falls back to defaults instead of breaking startup. Progress is pushed to the renderer once per second, and the session is saved with a short debounce after every change as well as in the quit finalizer.

Closing the window hides it to the tray, and the app keeps seeding until "Quit" is chosen from the tray menu. A second launch, a click on a magnet link or opening a `.torrent` file reaches the running instance, which adds the torrent to the default folder and brings the window forward.

## Limitations

The client relies on webtorrent, so it lacks some features of mature clients: there is no per-torrent speed limit, no queueing with a maximum number of active downloads, no encryption preference, no RSS and no web interface. Speed limits apply to the whole client. Peers are found through trackers, the DHT and peer exchange, and connections use TCP and uTP; WebRTC peers from browsers are not reachable from the main process.

Only Windows and Linux are packaged. The code handles macOS events for opened links and files, but there is no macOS target, signing or notarization. On Linux the tray menu is built once at startup because most desktop environments do not report clicks on the icon, so its "Show" and "Hide" entry does not switch labels there. Auto-update works for the NSIS installer and the AppImage; the deb package can be updated by installing a newer deb, and an unpacked build from `dist/win-unpacked` logs a missing `app-update.yml` because it was never installed. Launching on startup takes effect only in the installed app.
