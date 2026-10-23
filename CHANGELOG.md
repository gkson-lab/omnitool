# Changelog

## OmniTool 1.1 (2026-10-22)

- **Omni Agent - Onyx.** Omni Agent has its own engine that runs on your device with no internet, no account and no download. It replaces the old offline mode: it holds a simple conversation, remembers your name and what you ask it to keep (on this device only), answers questions about OmniTool, defines common developer terms, finds the right tool from a description, and runs the same commands as before. A switch in the agent panel picks Onyx or Claude. Measured: 96.4% intent accuracy on 84 phrasings it was not built with, zero network requests. The standalone engine is published as [Onyx 1](https://github.com/gkson-lab/onyx).
- **The commands got guards.** "I forgot my password" no longer generates a password, "rock and roll" no longer rolls dice, and "I have problems at work" no longer runs the bug finder: each command now needs an actual request.
- **Much more motion (MOTION 3 in DESIGN.md).** The catalog row morphs into the tool page, pages arrive in reading order, markers and switches slide, changed values roll, fresh results get an ink sweep, random draws scramble before settling, 2048 tiles slide and merge, Minesweeper opens outward from your click, the theme spreads from the switch, toasts show how long they stay, and long pages pin a slim bar with the tool's name. Every motion has a written purpose, nothing loops on an idle screen, and reduced motion turns it all off. `tests/motion.js` checks all of that.
- **Fixed:** the page builder's style helper silently ignored CSS custom properties.

## OmniTool 1.0 (2026-10-22)

First release.

- Two editions from one code base: the desktop app for Windows 10 and 11 (all 150 tools) and the web page (133 tools). The tools are declared once in `shared/tools` and each one lists the editions it runs in.
- LabsCode (`labscode-beta-9`) runs as tool 001, docked inside the desktop window, with a small bridge extension so Omni Agent and the AI tools can read the open file and apply edits you approve.
- Omni Agent in both editions: Claude with your own API key, or a labelled offline mode without one. It runs the app's tools step by step and asks before every file write or delete.
- `desktop\start.bat` installs everything it needs into the OmniTool folder (Node.js if missing, Electron, koffi, LabsCode) without administrator rights.

### Fixed during testing, before release

- **A second LabsCode window floated outside OmniTool.** OmniTool started LabsCode with `--new-window`. When LabsCode had unsaved files to restore from its last session, that flag opened a new empty window next to the restored one: OmniTool docked one, and the other stayed on the desktop after OmniTool quit, sometimes stuck on a "Save changes?" prompt. OmniTool now starts LabsCode without the flag, and if a LabsCode window is already open it docks that one instead of starting another. Checked by quitting with an unsaved edit and reopening: one docked window, the edit restored, nothing left on the desktop.
- **The bridge could point at the wrong LabsCode window.** Every LabsCode window runs its own copy of the bridge, and the last one to start won, while a window that closed deleted the connection file even when another window had taken it over. The bridge now follows the window you focused last and only removes its own file.
- **Tool results reached Claude twice.** Many tools return their text and the same text as a download; the agent sent both, doubling the tokens for those calls (the stand-in test saw 20 UUIDs for 10). A download that repeats the text result is now sent as a one-line note.
- **Space on a focused stopwatch button started the clock.** The stopwatch's Space shortcut also fired when a button had focus, so tabbing to Reset and pressing Space started or stopped the clock instead. Space now presses the focused button; with nothing focused it still starts and stops the clock.
- **Clipboard history saved `{}` instead of text.** Electron 44 made `clipboard.readText()` and the other clipboard calls asynchronous, so the watcher stored unresolved promises. The watcher, the copy buttons and the history writer now await the new API.
- **The JavaScript console did nothing on desktop.** The desktop window's content security policy blocks `eval` in the page, so the console now runs code in a worker loaded from `shared/core/js-worker.js`.
- **The currency converter failed.** api.frankfurter.app now redirects to a host that sends no CORS header, so the browser blocked the answer. The tool calls api.frankfurter.dev directly.
- **A clean install could stop after downloading LabsCode.** On a clean machine, Windows refused to rename the freshly unpacked folder (`EPERM`). The archive now unpacks in place and a marker file is written last, so an interrupted unpack is detected and redone.
- **Some tools scrolled sideways on phones.** The function plotter and notes kept their side panels beside the main area at every width; tools with a side panel now stack it below 760 px of tool width.

## LabsCode bugs found and fixed

OmniTool installs these fixes into its own copy of LabsCode (a fixed LabsCode Extras 1.0.2 replaces the built-in 1.0.0). The same changes are in `desktop/labscode/fork-fixes/labscode-fixes.patch` for the LabsCode repository; it applies with `git apply` to the files in `labscode-beta-9`.

Each entry says how it was confirmed: **tested** means it was reproduced or measured in a running LabsCode, **read** means it was found by reading the code and the fix has not been exercised in a running copy.

### LabsCode Extras (`extensions/labscode-extras`)

1. **The edit tally counted reloads from disk as typing** (tested). A file changed outside LabsCode, for example by `git checkout` or a formatter, fires the same change event as typing, so a 50-line reload added 50 lines to "today". The tally now counts a change only if the file is still modified afterwards. In the test, a 50-line reload changed the document (version 1 to 2) and added nothing; the next two edits added 2 and then 1.
   A first version of this fix skipped changes whenever the document was not yet marked modified. The test showed that flag lags one event behind, so the first edit after every save went uncounted. The shipped version checks the flag once it has caught up.
2. **The edit tally kept yesterday's numbers after midnight** (read). The status bar only reset on the next edit, so it showed the previous day's count until you typed. A timer now resets it just after local midnight.
3. **Reloading the window cancelled a running focus session** (read). The session's end time lived only in memory. It is now kept in LabsCode's extension storage and the countdown resumes after a reload or restart.
4. **A focus length typed into settings.json was used unchecked** (read). The 1 to 240 minute limits only apply in the Settings editor, so `"labscode.focus.minutes": 0` or a text value started a zero-length or broken session. The value is now clamped to 1 to 240 minutes, defaulting to 25.
5. **Red pen left stale markers in other files** (read). When several files changed within 200 ms of each other (Replace All across files, a rename refactor), only the last one was repainted. It now repaints every file changed since the last repaint.
6. **The red pen setting described a different look** (read). Its description said "Underline" while the markers are bold light red. The description now matches.

### LabsCode themes

Measured with the WCAG 2 contrast formula. Normal text needs 4.5:1; borders and guides need 3:1.

| Theme | Color | Before | After |
|---|---|---|---|
| LabsCode Dark | Input placeholder text on the input background | #555555, 2.67:1 | #8C8C8C, 5.92:1 |
| LabsCode Dark | Status bar text while debugging | #FFFFFF on #F36868, 3.00:1 | #000000, 6.99:1 |
| LabsCode Light | Input placeholder text | #999999, 2.85:1 | #6E6E6E, 5.10:1 |
| LabsCode Light | Selected tab text on #F47171 | #333333, 4.48:1 | #202020, 5.78:1 |
| LabsCode Light | Inactive tab text on #F47171 | #606060, 2.23:1 | #202020, 5.78:1 |
| LabsCode Light | Title bar text in an inactive window | #606060, 2.23:1 | #202020, 5.78:1 |
| LabsCode Light | Active indent guide on white | #EEEEEE, 1.16:1 | #939393, 3.07:1 |
| LabsCode Light | Other indent guides on white | #FFFFFF at 25 % opacity, invisible | #D3D3D3, 1.50:1, visible but quiet |

### Lite scripts (`lite/`)

7. **install-deps.bat reinstalled every tool on every run** (read). It ran `choco install` for Node.js, Python, Git and Rust unconditionally although its header said it skipped installed tools. It now runs each tool first (`node --version`, `python -V`, `git --version`, `rustup --version`) and installs only what fails. Running `python -V` also catches the Microsoft Store shortcut, which exists but does not work until Python is installed.
8. **install-deps.bat could not elevate from some folders** (read). The script path was pasted inside single quotes in a PowerShell command, so a folder name containing an apostrophe broke the "run as administrator" step. The path now goes through an environment variable.
9. **install-deps.bat failed at the end on a fresh machine** (read). It called Chocolatey's `RefreshEnv.cmd` without checking it exists, then ran `npm install -g @anthropic-ai/claude-code` even when npm was not on PATH yet, and reinstalled Claude Code when it was already there. Each step now checks first and says what it skipped.
10. **labscode.bat and labscode.sh said "LabsCode Lite"** (read). Both scripts ship with the full edition too; the comments now say so.

## Notes on LabsCode behavior OmniTool works around

These are not bugs, but each one cost time during the build:

- In portable mode (a `data` folder next to LabsCode.exe) LabsCode ignores `--user-data-dir`, so OmniTool writes the settings docking needs into LabsCode's portable settings file.
- This build refuses to update a built-in extension from the command line ("not allowed to be updated in the current product quality"), so OmniTool copies the fixed LabsCode Extras over the built-in folder in its private copy.
- The bridge activates after LabsCode finishes starting, roughly 10 to 15 seconds after launch; the agent's LabsCode tools wait up to 20 seconds for it.
