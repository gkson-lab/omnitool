# OmniTool design

Reading this as: a desktop and web multitool for developers who keep it open beside their work, in the gklabs paper, ink and signal-red language with a parts-catalog motif, dial ENERGY 2 / RHYTHM 2 / MOTION 3.

Direction from the owner: use the gklabs brand (the same values as gklabs Device Manager's DESIGN.md and the gklabs showcase), built under the antislop rules.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 3

On 2026-10-22 the owner asked for the whole app to feel much more animated, so MOTION went from 2 to 3. For a tool app, 3 means choreography: coordinated motion that shows where you came from and what just changed. It does not mean decoration on idle screens.

## Decisions and reasons

- **Palette: gklabs paper, ink and signal red.** It is the owner's brand, and LabsCode's own themes are light red, so the editor tab and the rest of the app read as one product. Light: paper `#f6f3f2`, surface `#ffffff`, sunken `#efe9e7`, ink `#1d1716`, muted `#6c605d`, line `#e2d9d6`, signal `#c4242b`. Dark: paper `#120e0d`, surface `#1b1514`, sunken `#0d0a09`, ink `#f1e9e7`, muted `#a3928e`, line `#2f2523`, signal `#ff4a4f`.
- **One added token, edge (`#8a7d79` light, `#7a6a66` dark), for form-control borders.** The brand's line color is 1.39:1 against white, which is fine for panel separators but fails the 3:1 a text field's border needs. Edge is 3.97:1 on white and 3.51:1 on the dark surface.
- **Signal red means "do this" or "this went wrong", nothing else.** It marks the one primary button of the current tool, error messages (always with text, never color alone) and the approval card when Omni Agent waits for you. A screen at rest shows at most one red button.
- **Code and diff colors are functional and stay inside code views.** Syntax highlighting uses keywords in bold ink plus four hues for strings, numbers, tags and types (all 5.2:1 or more in light, measured on the sunken code background, and 8.7:1 or more in dark); diffs mark additions in green and removals in signal red because that is the convention people read diffs by. Neither leaks into the chrome.
- **Light and dark both ship, defaulting to the system setting.** People keep a multitool open for hours across day and night; the toggle offers System, Light and Dark and remembers the choice.
- **Type: Archivo for words, Martian Mono for readings and code.** Archivo's width axis gives headings an expanded instrument-label voice (width 118), body text at 100, and dense catalog rows at 88 so more fits without shrinking the size. Martian Mono's even-width numerals keep results from jumping as they change. Code editors use Martian Mono at width 87.5 so a normal line length fits. Both fonts are bundled, so the web edition works offline.
- **Sentence case, no wide-tracked capitals.** Labels are set by weight and size.
- **Identity motif: the parts catalog.** Every tool has a fixed catalog number, `No. 001` to `No. 150`, the same number used in FEATURES.md. The number sits above each tool name in Martian Mono, leads every row of the home catalog and every command-palette result, and typing a number in the palette finds that tool. It is real information (the numbering is the product's feature list), not decoration.
- **Second motif, shared with gklabs Device Manager: the scale.** Any reading that is a level between 0 and 100% (password entropy, contrast ratio, readability, size saved, Pomodoro progress) sits on a ruled scale of ticks, one tick per 5%, with the filled run in ink. It ties OmniTool to the other gklabs tools.
- **Focal point per screen.** Home: the search field, because finding a tool is the job. A tool page: its input and output pair, with the primary action as the only red. LabsCode tab: the editor itself, edge to edge.
- **Home is a catalog index, not a dashboard.** Pinned and recent tools come first (they are what people reopen), then all tools grouped by category as numbered rows. No stat cards, no feature cards: the catalog is the content.
- **Navigation: categories in a sidebar with real counts, plus Pinned and Recent.** Every entry opens a real view. Below 900 px the sidebar becomes a labeled "Tools" menu.
- **Radius scale: 2 / 4 / 8 / 14.** Scale ticks 2, chips and keys 4, controls 8, panels 14. Nothing is pill-shaped; the theme switch is a segmented control like every other mode switch.
- **Shadow only on things above the page:** the command palette, dialogs, toasts and the agent panel when it floats over a narrow window. Panels sit flat on the paper with a 1px line.
- **No glow, no gradients, no glass.** None of them serve hierarchy here. The only gradients in the app are the ones a user builds in the gradient tool.
- **Icons: a handful of drawn glyphs for chrome only** (search, pin, copy, close, menu, theme), stroke-matched to the 1px line weight. Categories carry no icons; their names and counts do the work.
- **Motion: parts slide along rails, ink lines draw, ticks fill.** One vocabulary, so movement reads as part of the catalog, not as effects. Two curves: a decisive ease-out (`0.2, 0.8, 0.2, 1`) for everything that moves, and a small overshoot only for confirmations (copy, pin, a finished step). Timings: 120 ms for exits and presses, 220 ms for arrivals, 360 ms for page parts, 40 ms between staged parts. Everything is triggered by something you did or by a real change; nothing loops on an idle screen. The only repeating animations are the ones that mark real work in progress (a running agent step, the loading dots), and `tests/motion.js` checks that none run at rest.
  - **Opening a tool:** the catalog row's number and name morph into the page's number and title (a view transition), and back when you return. It shows which tool opened and where you came from.
  - **Arriving on a page:** its parts come in 40 ms apart, in reading order (header, inputs, result), so the eye goes from what you fill in to what you get.
  - **Sidebar and segmented controls:** the current-page marker and the dark thumb slide from the old choice to the new one, so the move itself is visible.
  - **Search and the palette:** results slide into their new rank as you type, so you see the ranking change instead of a list that flickers. The palette's selection slides with the arrow keys.
  - **Results:** a changed number rolls (the old one leaves upward), a fresh result gets one ink line sweeping down it like a readout printing, and the scale's ticks fill one after another. Each one points at exactly what an edit changed.
  - **Random draws:** dice, coins, random numbers and list picks show muted candidates for about 400 ms before the result settles. Without this, a coin that comes up Heads twice looks like nothing happened.
  - **Confirmations:** Copy turns into a drawn check where you clicked, the pin swings into place and the sidebar count rolls, and a press sinks the button a pixel.
  - **Theme:** the new theme spreads as a circle from the switch you used.
  - **Overlays:** dialogs and the palette rise in and drop out (Escape included). Toasts slide in from the edge with a line that shows how long they stay, and pointing at one holds it. The agent panel comes in from its edge.
  - **Omni Agent:** messages arrive from their speaker's side; a running step has a short ink line travelling under it and its dot fills when done; an approval card gets one red ring that closes in, because a decision is waiting.
  - **Long pages:** a slim bar with the tool's number and name pins to the top once the header scrolls away (the dial's "pin"), and clicking it goes back up.
  - **Games and timers:** 2048 tiles slide to their cells, merges pop and the new tile grows in after the slide. Minesweeper opens outward from your click and shakes once when you hit a mine. A finished timer pulses three times, then rests.
  - **Reduced motion (the OS setting) turns all of it off**: no view transitions, no staged entrances, no scrambles, instant state changes.
- **States.** Every data view has a waiting state (with what it is waiting for), an empty state (with the one action that fills it) and an error state (what failed and what to do). Network tools say which outside service they call.
- **Spacing.** 4 px base. Tight groups inside a panel (8 to 12), larger gaps between panels (20 to 24), section gaps on the home catalog (40), so the eye groups by panel first.
- **Logo.** No logo was supplied, so the product name is set as text ("OmniTool" in Archivo at width 118) with "gklabs" under it in muted mono.
