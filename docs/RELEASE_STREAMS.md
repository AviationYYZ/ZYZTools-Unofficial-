# ZYZTools release streams

The developer app is **ZYZTools test**. It stays separate from the consumer **ZYZTools** application. A beta release is now an update stream for the consumer app, not a renamed developer installer.

## Publish

In ZYZTools test, open Advanced, choose Beta or Stable and Essential or Non-essential, then click Publish to GitHub. The matching consumer installer is bundled in the developer app; no installer selection is required. GitHub access requires Contents read/write for AviationYYZ/ZYZTools-Unofficial-.

- Beta: source on beta, tag vVERSION-beta, GitHub prerelease, consumer ZYZTools installer.
- Stable: source on main, tag vVERSION, normal GitHub release marked latest, consumer ZYZTools installer.
- Essential: release contains the exact marker `<!-- zyztools-update:essential -->`. The consumer app checks its selected stream at startup, validates and downloads a newer installer, starts silent installation and exits. Network failures do not stop the app from opening.
- Non-essential: available in Advanced through Check for updates and Download update. No automatic installation.

The selected update stream is remembered. Stable is the default. Essential beta releases affect only users who selected Beta; stable users remain on Stable. Switching streams does not downgrade an already-newer installed version.

Install the new consumer build once to enable these behaviors. Older versions do not gain them from changing a GitHub release title. Renaming an old developer release does not turn its test installer into a consumer installer.

Build locally with npm run dist in electron-app. It builds the consumer installer first, then embeds it in the developer installer. A Publish click authorizes the chosen stream only; building never publishes. Do not edit release titles or prerelease status to promote a beta: publish the same build to Stable from the developer app instead.

If upload fails after source was pushed, inspect the draft release before retrying. Existing release tags are never overwritten automatically.
