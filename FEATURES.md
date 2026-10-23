# OmniTool features

150 tools, numbered the same way everywhere in the app (each tool page shows its number, e.g. `No. 044`). D = desktop edition, W = web edition.

The Status column comes from the test reports described in the [Test log](#test-log) and says how far each tool was exercised, in every edition it is in:

- **opened**: the page rendered in four layouts (desktop light, desktop dark, phone, tablet) with no errors and no sideways scrolling. For the 133 tools in the web edition, every button on the page was also clicked there without errors.
- **ran**: as above, and running it with its default input returned a result.
- **flow**: a scripted click-through of its main actions (adding, completing, moving, deleting and so on).
- **native**: its desktop back end did the real thing in the deep test (processes, network, files, LabsCode).
- **Claude stand-in**: its Claude mode ran against the local stand-in for the Claude API.

## 1. Code and dev tools

| No. | Tool | D | W | What it does | Status |
|---|---|---|---|---|---|
| 001 | LabsCode editor | yes | cut | The full LabsCode (VS Code fork) embedded in a tab: explorer, tabs, highlighting, search, terminal, settings, LabsCode Extras | pass: native |
| 002 | Code Pad | yes | yes | Multi-tab code editor with syntax highlighting, find/replace and local saving; on desktop it also opens and saves real files | pass: flow |
| 003 | JSON formatter | yes | yes | Pretty-print, minify and validate JSON, with the line and column of any error | pass: ran |
| 004 | JSON tree explorer | yes | yes | Collapsible tree of a JSON document; click a node to copy its path | pass: opened |
| 005 | JSON to TypeScript | yes | yes | Generates TypeScript interfaces from a JSON sample | pass: ran |
| 006 | YAML and JSON converter | yes | yes | Converts YAML to JSON and back | pass: ran |
| 007 | XML formatter | yes | yes | Indents and validates XML, reporting parser errors | pass: ran |
| 008 | XML and JSON converter | yes | yes | Converts XML to JSON and JSON to XML | pass: ran |
| 009 | Code beautifier | yes | yes | Formats JavaScript, CSS and HTML with indent options | pass: ran |
| 010 | Code minifier | yes | yes | Minifies JavaScript (Terser), CSS and HTML and shows the size saved | pass: ran |
| 011 | SQL formatter | yes | yes | Formats SQL for several dialects with keyword case options | pass: ran |
| 012 | JavaScript linter | yes | yes | JSHint warnings with line numbers and selectable options | pass: ran |
| 013 | Regex tester | yes | yes | Live matches, capture groups, flags and a replace preview | pass: ran |
| 014 | Regex explainer | yes | yes | Breaks a regular expression into tokens and explains each one | pass: ran |
| 015 | Diff viewer | yes | yes | Side-by-side line diff of two files with a unified patch export | pass: ran |
| 016 | Snippet manager | yes | yes | Save, tag, search and copy code snippets; send one to Code Pad | pass: opened |
| 017 | Commit message builder | yes | yes | Builds and validates Conventional Commits messages | pass: ran |
| 018 | .gitignore generator | yes | yes | Combines ignore templates for languages, editors and operating systems | pass: ran |
| 019 | Git repository inspector | yes | cut | Status, branches, recent log and diff stat of a local repository | pass: native |
| 020 | JWT decoder | yes | yes | Decodes header and payload and checks expiry (no signature verification) | pass: ran |
| 021 | Cron explainer | yes | yes | Describes a cron expression in plain English and lists the next run times | pass: ran |
| 022 | Semver checker | yes | yes | Tests versions against npm-style ranges and computes bumps | pass: ran |
| 023 | Chmod calculator | yes | yes | Converts Unix permissions between octal and rwx | pass: ran |
| 024 | HTML, CSS and JS playground | yes | yes | Live preview of HTML, CSS and JavaScript in a sandboxed frame | pass: opened |
| 025 | JavaScript console | yes | yes | Runs JavaScript in a sandboxed frame and shows console output | pass: ran |
| 026 | Script runner | yes | cut | Runs Python, Node or PowerShell code and shows stdout, stderr and exit code | pass: native |
| 027 | Project scaffolder | yes | cut | Creates a starter project folder (static site, Node CLI, Python script) after confirmation | pass: native |

## 2. Generators

| No. | Tool | D | W | What it does | Status |
|---|---|---|---|---|---|
| 028 | Random number generator | yes | yes | Integers or decimals in a range; uniform, normal, exponential or Poisson; optional seed; unique values | pass: ran |
| 029 | Dice roller | yes | yes | Dice notation (3d6+2, 4d6kh3), advantage and roll history | pass: ran |
| 030 | Coin flipper | yes | yes | Flips one or many coins and reports counts and the longest streak | pass: ran |
| 031 | ID generator | yes | yes | UUID v4 and v7, ULID and Nano ID in bulk | pass: ran |
| 032 | Password generator | yes | yes | Character-set passwords with entropy, ambiguous-character exclusion | pass: ran |
| 033 | Passphrase generator | yes | yes | Word-list passphrases with separator, capitals and digits options | pass: ran |
| 034 | Lorem ipsum generator | yes | yes | Paragraphs, sentences or words of placeholder text | pass: ran |
| 035 | Color palette generator | yes | yes | Complementary, analogous, triadic, tetradic and shade palettes from a base color | pass: ran |
| 036 | Test data generator | yes | yes | Rows of obviously fake test data (example.com emails, 555 phone numbers) as JSON, CSV or SQL | pass: ran |
| 037 | QR code generator | yes | yes | Text, URL or Wi-Fi QR codes with error level and size; PNG and SVG download | pass: ran |
| 038 | Barcode generator | yes | yes | Code 128 barcodes as SVG or PNG | pass: ran |
| 039 | List randomizer | yes | yes | Shuffles a list, picks winners or splits it into teams | pass: ran |
| 040 | Identicon generator | yes | yes | Deterministic geometric avatars from any text, as SVG or PNG | pass: ran |
| 041 | Placeholder image generator | yes | yes | Sized placeholder images with label and colors, as PNG or SVG | pass: ran |
| 042 | Number sequence generator | yes | yes | Ranges with step, zero padding, prefix and suffix (file001 to file100) | pass: ran |

## 3. Converters

| No. | Tool | D | W | What it does | Status |
|---|---|---|---|---|---|
| 043 | Unit converter | yes | yes | Length, mass, temperature, volume, area, speed, data, time, pressure and energy | pass: ran |
| 044 | Number base converter | yes | yes | Binary, octal, decimal, hex and any base from 2 to 36, with big integers | pass: ran, flow |
| 045 | Timestamp converter | yes | yes | Unix seconds or milliseconds to ISO, local and relative time, and back | pass: ran |
| 046 | Time zone converter | yes | yes | Converts a date and time between IANA time zones | pass: ran |
| 047 | Base64 encoder | yes | yes | UTF-8 safe Base64 and Base64URL encode and decode | pass: ran |
| 048 | File and data URI converter | yes | yes | File to data URI, and data URI back to a downloadable file | pass: opened |
| 049 | URL encoder | yes | yes | Component and full-URL percent encoding and decoding | pass: ran |
| 050 | URL parser | yes | yes | Splits a URL into parts and edits its query parameters | pass: ran |
| 051 | HTML entity converter | yes | yes | Encodes and decodes HTML entities | pass: ran |
| 052 | Case converter | yes | yes | camel, Pascal, snake, kebab, constant, title, sentence case and URL slugs | pass: ran |
| 053 | Markdown to HTML | yes | yes | Live sanitized preview and the HTML source | pass: ran |
| 054 | CSV and JSON converter | yes | yes | CSV (with quotes and custom delimiters) to JSON and back | pass: ran |
| 055 | Table converter | yes | yes | CSV or TSV to a Markdown table, HTML table or SQL inserts | pass: ran |
| 056 | Image converter | yes | yes | Converts images between PNG, JPEG and WebP, with resize and quality | pass: opened |
| 057 | Color format converter | yes | yes | HEX, RGB, HSL, HSV, CMYK and OKLCH | pass: ran |
| 058 | Roman numeral converter | yes | yes | Roman numerals to numbers and back (1 to 3999) | pass: ran |
| 059 | Number to words | yes | yes | Writes numbers out in English words, including check-style amounts | pass: ran |
| 060 | Text and binary converter | yes | yes | Text to binary, hex, octal or decimal byte codes and back | pass: ran |
| 061 | Unicode inspector | yes | yes | Code points, names of character classes, UTF-8 bytes and escapes for each character | pass: ran |
| 062 | String escaper | yes | yes | Escapes and unescapes strings for JSON, JavaScript, HTML attributes, SQL, CSV and regex | pass: ran |
| 063 | Morse code translator | yes | yes | Text to Morse and back, with audio playback | pass: ran |
| 064 | Currency converter | yes | yes | Converts with European Central Bank reference rates from the Frankfurter API (needs internet) | pass: ran |
| 065 | Coordinate converter | yes | yes | Decimal degrees to degrees, minutes, seconds and back | pass: ran |

## 4. Calculators and math

| No. | Tool | D | W | What it does | Status |
|---|---|---|---|---|---|
| 066 | Scientific calculator | yes | yes | Functions, constants, degrees or radians, memory and history | pass: ran |
| 067 | Programmer calculator | yes | yes | Bitwise operations, word sizes, signed and unsigned views and a bit grid | pass: ran |
| 068 | Percentage calculator | yes | yes | X% of Y, X as a percent of Y, and percent change | pass: ran |
| 069 | Matrix calculator | yes | yes | Add, multiply, transpose, determinant, inverse and row reduction | pass: ran |
| 070 | Graphing calculator | yes | yes | Plots several functions with pan, zoom and a trace readout | pass: ran |
| 071 | Statistics calculator | yes | yes | Mean, median, mode, deviation, quartiles and a histogram | pass: ran |
| 072 | Polynomial root finder | yes | yes | Real and complex roots of a polynomial of any degree | pass: ran |
| 073 | Date calculator | yes | yes | Difference between dates, business days, and adding or subtracting days | pass: ran |
| 074 | Time duration calculator | yes | yes | Adds and subtracts hh:mm:ss durations | pass: ran |
| 075 | Loan calculator | yes | yes | Payment, total interest and an amortization table | pass: ran |
| 076 | Tip and bill splitter | yes | yes | Tip, total and per-person share with rounding | pass: ran |
| 077 | Aspect ratio calculator | yes | yes | Simplifies ratios and solves the missing width or height | pass: ran |
| 078 | Prime factors, GCD and LCM | yes | yes | Factorization, primality, GCD and LCM of several numbers | pass: ran |
| 079 | Fraction calculator | yes | yes | Exact fraction arithmetic and mixed numbers | pass: ran |
| 080 | Combinatorics calculator | yes | yes | Factorials, permutations, combinations and binomial probability | pass: ran |
| 081 | Math notebook | yes | yes | Line-by-line calculations with variables and running results | pass: ran |

## 5. Text tools

| No. | Tool | D | W | What it does | Status |
|---|---|---|---|---|---|
| 082 | Word counter | yes | yes | Words, characters, sentences, paragraphs, reading time and top words | pass: ran |
| 083 | Find and replace | yes | yes | Plain or regex find and replace with case and whole-word options | pass: ran |
| 084 | Sort lines | yes | yes | Alphabetical, natural, numeric, by length, reverse or random order | pass: ran |
| 085 | Remove duplicate lines | yes | yes | Removes repeated lines, optionally ignoring case and whitespace | pass: ran |
| 086 | Text diff | yes | yes | Word or character level inline differences between two texts | pass: ran |
| 087 | Hash generator | yes | yes | MD5, SHA-1, SHA-256, SHA-384, SHA-512 and CRC32 of text | pass: ran, flow |
| 088 | HMAC generator | yes | yes | HMAC with SHA-1, SHA-256, SHA-384 or SHA-512 | pass: ran |
| 089 | File checksum verifier | yes | yes | Hashes a file and compares it with an expected checksum | pass: opened |
| 090 | Whitespace cleaner | yes | yes | Trims lines, collapses spaces, converts tabs and line endings | pass: ran |
| 091 | Line transformer | yes | yes | Numbers lines, adds prefixes or suffixes, quotes and joins them | pass: ran |
| 092 | Readability score | yes | yes | Flesch reading ease, grade level and long-sentence list | pass: ran |
| 093 | Text extractor | yes | yes | Pulls emails, URLs, IP addresses, numbers or hashtags out of text | pass: ran |
| 094 | Text to speech | yes | yes | Reads text aloud with the system voices, rate and pitch | pass: opened |
| 095 | Text encryption | yes | yes | AES-GCM encryption with a passphrase (PBKDF2), and decryption | pass: opened |
| 096 | Password strength checker | yes | yes | Entropy, crack-time estimate and weaknesses found in a password | pass: opened |
| 097 | Template filler | yes | yes | Fills a {{placeholder}} template once per CSV row | pass: ran |

## 6. Productivity

| No. | Tool | D | W | What it does | Status |
|---|---|---|---|---|---|
| 098 | To-do list | yes | yes | Tasks with priority, due date, filters and keyboard reordering | pass: flow |
| 099 | Notes | yes | yes | Markdown notes with search and preview | pass: flow |
| 100 | Pomodoro timer | yes | yes | Work and break cycles with notifications and a count of sessions today | pass: flow |
| 101 | Stopwatch | yes | yes | Stopwatch with laps and split times | pass: flow |
| 102 | Countdown timers | yes | yes | Several named countdowns with an alarm tone | pass: opened |
| 103 | Clipboard history | yes | cut | Keeps text you copy anywhere on the PC; search, pin and copy back | pass: native |
| 104 | Calendar | yes | yes | Month view with local events and .ics export | pass: flow |
| 105 | World clock | yes | yes | Live clocks for the time zones you pick | pass: opened |
| 106 | Habit tracker | yes | yes | Daily check-offs with current and best streaks | pass: opened |
| 107 | Kanban board | yes | yes | Columns and cards you can move with buttons or drag | pass: flow |
| 108 | Time tracker | yes | yes | Start and stop timers per project, totals and CSV export | pass: opened |
| 109 | Focus noise | yes | yes | White, pink and brown noise generated in the browser | pass: opened |
| 110 | Quick launcher | yes | cut | Pinned folders, programs and URLs that open with one click | pass: opened (launching not tested) |
| 111 | Screen capture | yes | cut | Captures a screen or window to PNG after you choose where to save it | pass: native |

## 7. Network and system

| No. | Tool | D | W | What it does | Status |
|---|---|---|---|---|---|
| 112 | System information | yes | cut | OS, CPU, memory, uptime, network interfaces and the user account | pass: ran, native |
| 113 | Process viewer | yes | cut | Lists processes with memory use; ending one asks first | pass: native |
| 114 | Ping | yes | cut | Pings a host with the system ping and shows each reply | pass: native |
| 115 | Traceroute | yes | cut | Traces the route to a host with the system tracert or traceroute | pass: native |
| 116 | DNS lookup | yes | yes | A, AAAA, MX, TXT, NS and CNAME records (desktop: system resolver; web: Cloudflare DNS over HTTPS) | pass: ran, native |
| 117 | Port checker | yes | cut | Tests whether a TCP port on a host accepts connections | pass: ran, native |
| 118 | Disk usage | yes | cut | Free and total space of each drive | pass: ran, native |
| 119 | Folder size analyzer | yes | cut | The largest folders and files inside a folder | pass: native |
| 120 | Environment variables | yes | cut | Searchable list of the app's environment variables, PATH split into entries | pass: native |
| 121 | IP and connection info | yes | yes | Public IP (ipify), connection type and online state | pass: ran |
| 122 | Browser and device info | yes | yes | Parsed user agent, screen, language and supported web features | pass: ran |
| 123 | HTTP request tester | yes | yes | Sends requests with method, headers and body; shows status, headers, timing and body | pass: native |
| 124 | Subnet calculator | yes | yes | Network, broadcast, host range and mask for an IPv4 CIDR | pass: ran |
| 125 | Bulk file renamer | yes | cut | Renames files by pattern with a preview; applying asks first | pass: native |
| 126 | Static file server | yes | cut | Serves a folder on localhost at a port you choose | pass: native |

## 8. Design tools

| No. | Tool | D | W | What it does | Status |
|---|---|---|---|---|---|
| 127 | Color picker | yes | yes | Picker with an eyedropper where the browser supports it, and recent colors | pass: opened |
| 128 | Gradient builder | yes | yes | Linear and radial gradients with stops and CSS output | pass: opened |
| 129 | Box shadow generator | yes | yes | Layered box shadows with CSS output | pass: opened |
| 130 | Border and radius generator | yes | yes | Border width, style and per-corner radius with CSS output | pass: ran |
| 131 | Contrast checker | yes | yes | WCAG contrast ratio and AA/AAA verdicts for a text and background pair | pass: ran |
| 132 | SVG previewer | yes | yes | Previews SVG on light and dark, strips metadata and shows the size saved | pass: ran |
| 133 | Type scale generator | yes | yes | Modular type scale with CSS custom properties | pass: ran |
| 134 | Favicon generator | yes | yes | Favicons from text or an image as PNG sizes and a .ico file | pass: opened |
| 135 | Image color extractor | yes | yes | Dominant colors of an image (k-means) | pass: opened |
| 136 | CSS grid generator | yes | yes | Columns, rows and gaps with a live preview and CSS output | pass: ran |

## 9. AI tools

Each works with an Anthropic API key; without one each has a labeled offline mode (noted in the last column).

| No. | Tool | D | W | What it does | Status |
|---|---|---|---|---|---|
| 137 | Omni Agent (Onyx and Claude) | yes | yes | Chat and tool automation. Onyx runs on the device (conversation, OmniTool help, tool finding, commands, memory); Claude takes over with an API key. Shows each step and asks before any file write or delete | pass: flow, native, Claude stand-in |
| 138 | Code explainer | yes | yes | Explains code. Offline: an outline of imports, functions, classes and complexity | pass: ran, Claude stand-in |
| 139 | Bug finder | yes | yes | Reviews code for bugs. Offline: lint plus common-mistake checks | pass: ran |
| 140 | Doc comment writer | yes | yes | Writes JSDoc or docstrings. Offline: comment skeletons from signatures | pass: ran |
| 141 | Commit message writer | yes | yes | Writes a commit message from a diff. Offline: a Conventional Commits message from the diff stats | pass: ran, native |
| 142 | Unit test writer | yes | yes | Writes tests. Offline: test skeletons for each function | pass: ran |
| 143 | Code refactorer | yes | yes | Rewrites code to an instruction with a diff preview. Offline: rename, var to let/const and console.log removal | pass: ran |
| 144 | Text summarizer | yes | yes | Summarizes text. Offline: extractive summary of the highest-scoring sentences | pass: ran |
| 145 | Regex builder | yes | yes | Builds a regex from a description. Offline: infers a pattern from example strings | pass: ran |

## 10. Fun

| No. | Tool | D | W | What it does | Status |
|---|---|---|---|---|---|
| 146 | Snake | yes | yes | Keyboard and touch Snake with a saved best score | pass: flow |
| 147 | 2048 | yes | yes | The 2048 sliding puzzle with keyboard and swipe | pass: flow |
| 148 | Minesweeper | yes | yes | Three difficulty levels, flags, keyboard play | pass: flow |
| 149 | Typing speed test | yes | yes | Words per minute and accuracy on generated word lists | pass: opened |
| 150 | ASCII art generator | yes | yes | Block-letter text banners and image-to-ASCII conversion | pass: opened |

## Web edition cuts

The web edition has 133 of the 150 tools. These 17 need the desktop app because a browser page cannot reach the file system, other programs or the network stack:

| No. | Tool | Why it is desktop only |
|---|---|---|
| 001 | LabsCode editor | LabsCode is a native Electron application; the web edition uses Code Pad (002) instead |
| 019 | Git repository inspector | Runs the git command on local folders |
| 026 | Script runner | Starts Python, Node and PowerShell processes |
| 027 | Project scaffolder | Creates folders and files on disk |
| 103 | Clipboard history | Browsers only read the clipboard on a user gesture, so background history is impossible |
| 110 | Quick launcher | Opens local programs and folders |
| 111 | Screen capture | Needs the desktop capture API and saving to disk |
| 112 | System information | Browsers do not expose CPU, memory or OS details |
| 113 | Process viewer | Browsers cannot list or end processes |
| 114 | Ping | Browsers cannot send ICMP packets |
| 115 | Traceroute | Needs the system tracert command |
| 117 | Port checker | Browsers cannot open raw TCP connections |
| 118 | Disk usage | Browsers do not expose drives |
| 119 | Folder size analyzer | Needs recursive file system access |
| 120 | Environment variables | Browser pages have no process environment |
| 125 | Bulk file renamer | Renames files on disk |
| 126 | Static file server | Browsers cannot listen on a port |

## Test log

Final runs on 2026-10-22, after the motion and Onyx work, on Windows 11 (build 26200): headless Chrome for the web edition, Electron 44.6.0 for the desktop edition. Each run writes its raw results to `tests/report-*.json` (not committed).

| What | Command | Result |
|---|---|---|
| Web self-test | `npm run test:web` | 133 tools registered, 0 boot errors. 532 page visits (every tool in 4 layouts), 0 with problems. 17 of 17 flows passed. 0 console errors or warnings. |
| Desktop self-test | `npm run test:desktop` | 150 tools registered, 0 boot errors. 597 page visits, 0 with problems (LabsCode is opened in the first layout only, so it is not docked four times). 17 of 17 flows passed. 0 console errors or warnings. |
| Every button (web) | `node tests/click-all.js` | 739 buttons clicked across all 133 tools, each followed by Escape, with 0 page errors. A PNG was given to the 7 tools with file inputs: 6 produced their result (data URI, WebP conversion, checksums, favicons, dominant colors, ASCII art) and Code Pad refused it as a binary file. |
| Native features (desktop) | `node tests/desktop-deep.js` | 16 of 16 checks passed: system info, the PID 4 guard, DNS and ports, ping and traceroute, a rejected injected host name, git, Python, Node and PowerShell scripts (with a timeout), the agent's file access and its folder limits, writing without a dialog refused, the file server (a traversal attempt got 403), HTTP, rename and scaffold, clipboard history, screen capture, folder size, and the LabsCode bridge (an edit applied, a stale edit refused). |
| Claude mode | `node tests/agent-mock.js web` and `desktop` | 16 of 16 checks passed in each edition against the local stand-in for the Claude API: "generate 10 UUIDs and save them to a file" ran the ID generator, sent its result back, stopped for approval and saved the 10 UUIDs; a rejected save was not written and Claude was told; the code explainer streamed its answer; model, effort, refusal fallback and streamed tool input were in every request. |
| Motion (web) | `node tests/motion.js` | 14 of 14: nothing loops on an idle catalog or tool page; the catalog-to-tool view transition runs and leaves no names behind; page parts enter in order and finish; the sidebar marker, theme-switch thumb and palette selection land on their targets; changed readings roll; copy confirms and reverts; the tool bar pins on a long page; two coin flips scramble before settling; 2048 tiles slide; Minesweeper opens in rings; toasts count down and leave; Escape plays the dialog exit; with reduced motion on, nothing animates. |
| Onyx | `node tests/onyx.js` | 39 of 39: 96.4% intent accuracy on 84 phrasings not in its examples; a 32-step conversation (name memory, follow-ups, offers, glossary, tool finder, commands, typos, honest refusals, the crisis reply, forgetting); Onyx is the engine without a key and runs a command with steps in the panel; 0 network requests; 0 page errors. |
| Desktop setup | `desktop\start.bat --no-launch` | On this install: exit 0, "LabsCode is ready". Earlier in the build, on a copy with no Node.js on PATH: Node.js 24.21.0 downloaded and checked against its SHA-256, packages and Electron installed, LabsCode downloaded (384 MB), unpacked and set up. |

The flows: command palette (Ctrl+K, a number search, Enter), catalog search ("uuid" finds the ID generator first; nonsense shows the empty state), pin and recent, the three themes, the offline agent (a two-step task with an approved save, an unknown request answered honestly, a unit conversion), to-do, notes, kanban, calendar, stopwatch and pomodoro, 2048, minesweeper and snake, saving and removing an API key (a fake key sent to the real API is rejected with the friendly message), Code Pad, and the phone menu.

Checked with one-off scripts during the build, not part of `tests/`:

- **LabsCode end to end:** quitting OmniTool (Alt+F4) right after an unsaved edit, then reopening: LabsCode closed, the edit came back in the one docked window and no LabsCode window was left on the desktop. A LabsCode window left open from an earlier session was docked instead of a second one being started.
- **Edit tally:** a 50-line reload from disk added nothing; the first and second edits after it added 2 and 1.
- **Keyboard:** tabbing through the catalog and a tool page in light and dark showed a 2 px focus outline on every stop; Ctrl+K moves focus into the palette and Escape closes it.
- **Contrast:** every text color token passes 4.5:1 in both themes (the lowest is muted text at 5.04:1); control borders pass 3:1; code colors pass 5.28:1 or more.
- **Stopwatch keys and web copy:** real key presses and a real mouse click, with the results read back.

Not tested automatically:

- **110 Quick launcher** was only opened: launching it starts programs on the screen.
- **Claude with a real key:** no valid API key was available during the build.
- The last fixes to Code Pad (refusing binary files) and the stopwatch (Space on a focused button) came after the two self-test runs above. The button crawler and the key test ran after them.
