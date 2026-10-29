# Clean Uniform Neat Torrent

Clean Uniform Neat Torrent is a desktop BitTorrent client for Windows, macOS and Linux. It is built on Electron with a React renderer, and all torrent work happens in the main process through webtorrent, wrapped in Effect services. The app is meant to be installed: settings, the saved session and caches live in the per-user application data folder, and new torrents are saved to the system Downloads folder unless another folder is chosen.

## Setup

The project needs Node.js 22 or newer and pnpm 10. After cloning the repository, run `pnpm install`. The install step also rebuilds the native uTP module for the bundled Electron version, which takes about a minute on the first run and needs a working C++ toolchain only when no prebuilt binary is available for the platform.

## Development

`pnpm dev` starts electron-vite with hot reload for the renderer and automatic restarts for the main process and preload. One environment detail matters here: the integrated terminal of VS Code exports `ELECTRON_RUN_AS_NODE=1`, which makes the Electron binary behave like plain Node and fail on startup with errors about unknown options. In such a terminal, start the app with `env -u ELECTRON_RUN_AS_NODE pnpm dev` in Git Bash, or clear the variable first with `Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell.

The dev command is a small Effect CLI in `scripts/dev.ts` that validates its flags before electron-vite starts. `pnpm dev --list=test` replaces the real torrent engine with six in-memory fixtures, one for each state the list can show: a finished download that is not seeding, a seeding torrent, a stalled download, a download that cycles from empty to complete every five seconds, a paused download and a torrent still waiting for metadata. `pnpm dev --list=3` loads only the first three of them, and any other value stops the script with the help text. In fixture mode nothing touches the network, the disk or `session.json`, so the real session is left as it was; pausing, resuming, removing, selecting files and adding magnets all work in memory. Production builds ignore the flag.

Before moving on from a change, run `pnpm typecheck`, which checks the main and renderer projects separately, and `pnpm lint`, which verifies Prettier formatting. `pnpm format` rewrites files into the expected style. The project has no ESLint configuration on purpose; strict TypeScript settings carry most of that load.

## Building

`pnpm dist` type-checks the sources, bundles them with electron-vite and packages the result with electron-builder for the current platform, without publishing anything. `pnpm dist:win` produces an NSIS installer in `dist/`, `pnpm dist:linux` produces an AppImage and a deb package, and `pnpm dist:mac` produces a DMG and a zip for Apple Silicon and for Intel Macs. The Linux targets are best built on Linux or in CI, and the macOS targets can only be built on a Mac, which in practice means CI. A full Windows build takes about two minutes once the Electron and NSIS downloads are cached.

The installer is assisted rather than one-click: it installs per user without administrator rights, lets the user pick the installation folder, and creates desktop and Start Menu shortcuts. Uninstalling keeps the application data, so a reinstall restores settings and the torrent list. Both the installer and the Linux packages register the app as the handler for `magnet:` links and `.torrent` files.

## Releasing

Releases are published to GitHub Releases of `piscopancer/clean-uniform-neat-torrent`, and the installed app updates itself from there. To cut a release, run `pnpm release` on a clean `main` and pick a patch, minor or major bump. release-it raises `version` in `package.json`, commits it, creates the `v` tag and pushes both. No local token is needed, because the build happens on GitHub.

The pushed tag starts the Release workflow in `.github/workflows/release.yml`, which builds the Windows installer, the Linux AppImage and deb packages and the macOS DMGs in parallel in about ten minutes. electron-builder uploads them into a draft release together with the `latest.yml`, `latest-linux.yml` and `latest-mac.yml` metadata that electron-updater reads. The draft is invisible to installed apps until it is published by hand on the Releases page, where GitHub can also generate the notes from the commits since the previous tag.

The installed app checks for updates ten seconds after launch and then every four hours. An update downloads in the background, and once it is ready a toast offers to restart; ignoring it is fine, because the update is also applied the next time the app quits. The Settings dialog shows the current update state and has a button for a manual check. On macOS the update is not downloaded, because Squirrel.Mac installs updates only into an app signed with a Developer ID; the toast and the Settings dialog instead offer to open the release page, where the new DMG can be downloaded by hand.

## Windows SmartScreen

The builds are not code-signed, so on first launch of the installer Windows SmartScreen shows a warning that the publisher is unknown. Choosing "More info" and then "Run anyway" starts the installer. The warning disappears only with a code-signing certificate that has built up reputation, which is outside the scope of this project; once a certificate is available, it can be configured through the standard `CSC_LINK` and `CSC_KEY_PASSWORD` variables of electron-builder without code changes.

## macOS Gatekeeper

The macOS builds are signed ad hoc, which is the minimum Apple Silicon needs to run an app, but they are neither signed with a Developer ID nor notarized. On first launch macOS therefore refuses to open the app and reports that Apple could not verify it. Opening System Settings, then Privacy & Security, and choosing "Open Anyway" next to the message about the app allows it once and for all. If macOS instead claims that the app is damaged, running `xattr -dr com.apple.quarantine "/Applications/Clean Uniform Neat Torrent.app"` in Terminal removes the quarantine flag that the browser set on the download. With an Apple Developer account, signing and notarization can be enabled through `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` together with removing `identity` and `hardenedRuntime` from the `mac` section of `electron-builder.yml`.

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

Closing the window hides it to the tray, and the app keeps seeding until "Quit" is chosen from the tray menu. A second launch, a click on a magnet link or opening a `.torrent` file reaches the running instance, which brings the window forward and opens the matching add dialog with the link or file filled in, so the folder and the files to download can be chosen before anything starts. Several files opened at once get their dialogs one after another.

## Limitations

The client relies on webtorrent, so it lacks some features of mature clients: there is no per-torrent speed limit, no queueing with a maximum number of active downloads, no encryption preference, no RSS and no web interface. Speed limits apply to the whole client. Peers are found through trackers, the DHT and peer exchange, and connections use TCP and uTP; WebRTC peers from browsers are not reachable from the main process.

The macOS build has not been tried on a real Mac yet, so details such as the position of the window buttons over the toolbar may need adjustment. On Linux the tray menu is built once at startup because most desktop environments do not report clicks on the icon, so its "Show" and "Hide" entry does not switch labels there. Auto-update works for the NSIS installer and the AppImage; the deb package can be updated by installing a newer deb, and an unpacked build from `dist/win-unpacked` logs a missing `app-update.yml` because it was never installed. Launching on startup takes effect only in the installed app.
