# Widget catalog

A working document. It records what the HyDE Waybar shows today, what each entry could offer
beyond its bar face, how two mature Quickshell shells (Caelestia, DankMaterialShell) organise the same
information, and what has been verified on the development machine (Arch, Hyprland 0.56, Quickshell
0.3.1, a laptop with two batteries and one NVMe disk). Statements marked *to verify* are not yet tested.

## 1. How to read this

Every widget is described in up to four layers, from quiet to rich:

| Layer | What | Interaction |
|---|---|---|
| **Face** | the entry in the bar; only the most important information | always visible |
| **Peek** | read-only detail panel | pointer rests on the face |
| **Panel** | interactive panel (settings, forms, controls) | click, stays open until closed |
| **Actions** | direct manipulation on the face | click, right-click, scroll |

The rule of thumb from the brief: the face shows the essentials, everything else hides behind it.

## 2. Inventory: your bar today

The active layout has six pills and 27 modules (`~/.config/waybar/config.jsonc`). Module definitions are
in `~/.local/share/waybar/modules/*.jsonc`.

| Pill | Module | Face today | Extra today | Actions today | Source |
|---|---|---|---|---|---|
| left 1 | `hyprland/workspaces` | numbered buttons, active one is a filled, wider pill | none | scroll switches workspace | Hyprland IPC |
| left 1 | `hyprland/window` | icon + window title | none | none | Hyprland IPC |
| left 2 | `custom/caffeine` | icon (idle inhibit on/off) | script tooltip | click toggles | `hyde-shell caffeine` (JSON) |
| left 2 | `clock` | `HH:MM:SS`, alt: time + date | tooltip: month calendar | scroll: month, right-click: mode | Waybar clock |
| centre | `cpu` | icon + usage %, alt: 8-step bars per core | none | none | /proc/stat |
| centre | `memory` | icon + used GiB, alt: % | usage %, used/total, available, swap | none | /proc/meminfo |
| centre | `custom/cpuinfo` | package temperature | per-core temps, utilisation, clock | none | `hyde-shell cpuinfo` (JSON) |
| centre | `custom/gpuinfo` | icon + temperature | GPU name, temp, fan RPM, utilisation, clock | click toggles GPU mode | `hyde-shell gpuinfo` (JSON) |
| right 1 | `backlight` | icon + % | level | scroll changes brightness | sysfs / brightnessctl |
| right 1 | `network` | Wi-Fi / Ethernet icon, alt: down/up speed | SSID, signal dBm + %, frequency, interface, IP/CIDR, gateway, netmask | none | NetworkManager |
| right 1 | `pulseaudio` | icon + volume | device description + % | click: pavucontrol, right: pick sink, middle: mute, scroll ±5 | PipeWire/Pulse |
| right 1 | `pulseaudio#microphone` | icon + volume | same for input | same | PipeWire/Pulse |
| right 1 | `custom/updates` | update count | script tooltip (list) | click: run update | `hyde-shell system.update` |
| right 1 | `custom/keybindhint` | icon | "Keybinds" | click: show keybinds | `hyde-shell keybinds_hint` |
| right 1 | `custom/weather` | icon, temperature, place | full text: current, 3-day forecast | click: refresh | `hyde-shell weather` (wttr.in) |
| right 2 | `privacy` | screenshare / microphone-in indicators (fade, 250 ms) | which app | none | PipeWire |
| right 2 | `tray` | status-notifier icons | app tooltips | click / right-click menus | SNI + DBusMenu |
| right 2 | `battery` | icon + capacity %, alt: time | none | none | UPower |
| right 3 | `custom/wallchange` | icon | "Switch wallpaper" | click next, right-click previous | `wallpaper.sh` |
| right 3 | `custom/theme` | icon | "Switch theme" | click next, right-click previous | `theme.switch.sh` |
| right 3 | `custom/wbar` | icon | "Switch bar / dock" | click next, right-click previous | `hyde-shell waybar` |
| right 3 | `custom/cliphist` | icon | "Clipboard history" | click: open history (rofi) | `hyde-shell cliphist` |
| right 3 | `custom/hyde-menu` | icon | "Right-click for more HyDE options" | right-click menu | menus/*.xml |
| right 3 | `custom/power` | icon | "Logout menu" | click: logout menu | `hyde-shell logoutlaunch` |

Script modules print one JSON object (`text`, `alt`, `tooltip`, `class`); that is the contract the
generic script component already speaks.

## 3. Shipped but not in your layout

Grouped; each could be added to a layout later.

- **Media:** `mpris`, `mpd`, `custom/mediaplayer`, `custom/spotify`, `custom/cava`, `cava`, `group/mediaplayer` (play/prev/next buttons)
- **System:** `temperature` (CPU/GPU/ACPI zones), `power-profiles-daemon`, `gamemode`, `custom/gamemode`, `idle_inhibitor`, `custom/hyprsunset`, `group/eyecare`, `custom/sensorsinfo`, `bluetooth`
- **Windows and workspaces:** `wlr/taskbar` (icons, with titles), `hyprland/language`, `hyprland/workspaces` kanji and roman variants
- **Shell and launchers:** `custom/app-launcher`, `custom/display`, `custom/dunst`, `custom/swaync`, `custom/workflows`, `custom/powermenu`, `custom/github_hyde`, `custom/clipboard`, `image#wallpaper`, `image#profile`, `user`
- **Groups:** `group/hide-tray`, `group/user-menu`, `group/volumecontrol`, `group/eyecare`

## 4. Target widgets

### 4.1 Weather

- **Face:** weather icon, temperature, place (as today).
- **Peek:** the three-day overview, **formatted as a table with aligned columns and no line breaks**:
  a header (place, now, feels like, humidity, wind), then per day a heading (date, high/low, sunrise,
  sunset) and one row per 3-hour slot with fixed columns (time, icon, temperature, condition, cloud, rain,
  wind). Monospace, no wrapping, the panel grows to the widest row. Today the overview is free text that
  wraps at the panel width and mixes emoji and variable-width text, so it cannot be aligned reliably.
- **Data:** `weather.py` already receives structured wttr.in data (`WttrResponse`, hourly points, day
  records) and the place from `[weather] location` in `~/.config/hyde/config.toml`. A weather source
  that reads the same location and requests the JSON form of wttr.in gives the table its columns
  directly. *To verify:* whether `weather.py` can emit that structure itself, which would avoid a second
  network client.
- **Actions:** click refreshes (as today; today via `pkill -RTMIN+10 waybar`).
- **Status (2026-09-30): implemented.** `services/Weather.qml` fetches wttr.in, `core/lib/weather.js` formats the data (tested, including the -99 to 99 °C and 0 to 100 % ranges), `components/WeatherPanel.qml` lays it out in a grid. A design review against Apple's HIG added column headings, a larger type size and the height fit that thins later days on small screens.
- **Reference shells:** Caelestia has a Weather tab (today, sunrise, sunset, humidity, feels like, forecast).
  DankMaterialShell offers current conditions, hourly, daily, sun/moon, humidity, wind, pressure,
  precipitation, visibility, UV, with a forecast/chart/cards switch and a refresh action.

### 4.2 Battery

- **Face:** state icon plus capacity of the combined battery (done; charging, discharging, plugged in).
- **Peek:** one column per battery: vendor, model, **serial number**, state, charge, energy now / full /
  design, **health** (capacity against design), charge cycles, technology, power draw and time to full or
  empty. Verified on this machine for `BAT0` (SANYO, serial 794, health 63.7 %, 498 cycles) and `BAT1`
  (SMP, serial 2525, health 74.1 %, 819 cycles).
- **Panel:** power profile switch (power-saver, balanced, performance) through power-profiles-daemon;
  optional history chart.
- **Data:** UPower for every device. *To verify:* which of serial, cycles and health the Quickshell
  `UPower` type exposes; otherwise a `upower -i` process at low frequency.
- **Reference shells:** Caelestia's battery popout shows remaining time, warnings and three power-profile
  buttons, and the Performance tab has an animated "battery tank". DankMaterialShell's popout shows
  health, temperature, capacity, power, time to full / left, profile management and a history chart.

### 4.3 Network

- **Face:** connection icon by type and signal, optionally the current speeds.
- **Peek:** what the tooltip shows today (SSID, signal, frequency, interface, IP/CIDR, gateway, netmask)
  plus a small throughput history.
- **Panel:** Wi-Fi on/off, scan, list of networks (signal, lock, connect, password prompt), Ethernet
  devices, VPN profiles, hotspot, forget saved networks, a link to the full editor. "Many settings hide
  behind this entry."
- **Data:** NetworkManager: `Quickshell.Networking` (new in 0.3.0, maturity *to verify*) or `nmcli`.
- **Reference shells:** Caelestia (network popout with toggle, list, password dialog, Ethernet list) and
  DankMaterialShell (Wi-Fi, Ethernet and cellular devices, scan, hotspot, VPN, device override).

### 4.4 Clock, calendar and timer

- **Face:** time (as today).
- **Peek and panel:** a month calendar with today highlighted; **scroll or chevrons move the month**;
  click a day for its agenda; **add a calendar entry**; **timers** (presets such as 5, 10, 25 minutes plus
  a custom time, list of running timers, a notification when one ends).
- **Data:** `SystemClock` for time; calendar arithmetic as pure JavaScript (testable). Timers live in a
  small state file so they survive a shell reload. **Open decision:** calendar entries need a backend
  (a khal/vdirsyncer setup, Evolution Data Server, or a plain `.ics` file); which one you use decides the
  design.
- **Reference shells:** Caelestia's dashboard has a calendar with previous/next month and a date/time
  card; DankMaterialShell's overview tab has the calendar with "New event" and "Edit event" dialogs.

### 4.5 System: CPU, GPU, memory, disk

- **Face:** one compact entry instead of today's four (`cpu`, `memory`, `cpuinfo`, `gpuinfo`): CPU usage,
  hottest temperature and small ring gauges for CPU and memory. *Decision:* one combined entry or two
  (CPU, GPU).
- **Peek:** sections for CPU (usage, per-core temperatures, clock), GPU (name, temperature, fan,
  utilisation, clock), memory (used, available, swap) and **storage**: free space per device and disk
  health.
- **Storage data, verified:** the `df` output lists one NVMe device (`/dev/nvme0n1p2`) under seven mount
  points (btrfs subvolumes), so results are de-duplicated by device. **Health without root:**
  `smartctl` is denied (permission), but udisks2 exposes NVMe SMART properties over D-Bus without
  privileges: critical warning (none), power-on hours (2332), temperature (304 K), self-test status
  ("success"). A wear percentage is *not* among those properties; `SmartGetAttributes` may need a polkit
  prompt (*to verify*, and not to be triggered blindly). Quickshell has no D-Bus client type for this,
  so a low-frequency `busctl` process would supply it.
- **Script data today:** `cpuinfo` returns temperatures per core plus utilisation and clock; `gpuinfo`
  returns name, temperature, fan, utilisation and clock (measured on this machine).
- **Reference shells:** Caelestia's Performance tab: CPU and GPU "hero" cards (usage ring, temperature with
  an alert above 90 °C), memory card, storage card with disk chooser, network card with an up/down
  sparkline, battery tank. DankMaterialShell: disk usage detail (mounts) and a process list.

### 4.6 Media

- **Face:** artist and title (truncated) with a play/pause glyph; hidden when nothing plays.
- **Panel:** **album art**, title, artist, album, seek bar with position and length, previous / play /
  next, shuffle, loop, volume, player selector; optional lyrics and an accent colour taken from the art.
- **Data:** MPRIS through `Quickshell.Services.Mpris` (art URL, position, length, shuffle, loop, seek,
  volume). *To verify:* behaviour with players that report no length.
- **Reference shells:** Caelestia's media tab (cover visualiser, details with seek slider, shuffle/loop,
  lyrics list) and DankMaterialShell's media tab (artwork styles, wave progress bar, album-art backdrop,
  accent from artwork, lyrics).

### 4.7 Audio and brightness

- **Face:** icon plus level, scroll to change (as today).
- **Peek:** device names. **Panel:** output and input selection, per-application volumes, mute;
  brightness slider (DankMaterialShell also lists backlight, DDC/CI monitors and LED devices).
- **Data:** PipeWire through `Quickshell.Services.Pipewire`; backlight through `brightnessctl` (done).

### 4.8 Workspaces and window title

- **Face:** the workspace buttons; the active one is a **filled pill that widens**, hover fills a softer
  pill. Window title next to it.
- **Data:** `Quickshell.Hyprland` (workspaces, active window, events).
- **Note:** this is where the HyDE look is most distinctive; see section 7.

### 4.9 Updates, privacy, tray, caffeine, actions

- **Updates:** face is the count; panel lists packages with "Update all" and an ignore list (DankMaterialShell
  has this, with "checked N minutes ago"). The script only prints a count and a tooltip today.
- **Privacy:** face shows only while something is captured; peek says which application.
- **Tray:** status-notifier icons with menus (`Services.SystemTray`, `DBusMenu`).
- **Caffeine:** toggle; a duration chooser (DankMaterialShell's "turn off now / for a duration" popout).
- **Wallpaper, theme, bar, clipboard, HyDE menu, power:** buttons with hover tooltips and click actions.

## 5. Interaction model

- **Peek (hover, read-only)** and **Panel (click, interactive)** are different components with different
  rules. A peek closes when the pointer leaves; a panel must survive the pointer moving into it, so it
  opens by click (or a peek that the user pins) and closes with Escape or an outside click.
- Caelestia's bar popouts open on hover and can be detached to stay open, which is the same idea.
- Every panel needs: one open at a time, position kept on screen, keyboard access (focus, Escape, arrows
  in lists), and the same motion tokens.
- Consequence: the current hover popup is the peek layer. A panel layer needs pointer bridging, focus
  grabbing and keyboard handling; it is a separate piece of work.

## 6. Data verified on the development machine

| Need | Result |
|---|---|
| Battery detail | UPower gives vendor, model, serial, energy now/full/design, capacity (health), cycles, technology, rate for `BAT0` and `BAT1` |
| Disks | one NVMe (`SAMSUNG MZVLW256HEHP`), btrfs subvolumes repeat the device; `df` needs de-duplication |
| Disk health | `smartctl` needs root; udisks2 D-Bus provides critical warning, power-on hours, temperature, self-test status without root; no wear percentage |
| CPU / GPU | `hyde-shell cpuinfo` / `gpuinfo` return JSON with temperatures, utilisation, clock (GPU also name and fan) |
| Weather | `weather.py` uses wttr.in with structured records; location from `[weather] location` |
| Fonts | JetBrainsMono Nerd Font and the Material Design icon range are installed |

## 7. Visual concept (HyDE Waybar, measured from the style files)

- **Pills:** entries sit in rounded groups, `border-radius: 10pt`, margin 0.3 em vertical, 1 em horizontal.
- **Colours** (from the generated `theme.css`, wallpaper-derived): `main-bg` = primary 1 at 80 %,
  `main-fg` = accent 1xa8 at 80 %, active fill = primary 4 at 40 %, active text = 4xa9, hover fill = a
  darker accent at 40 %, hover text = as `main-fg`. Bar itself is nearly transparent (1 %).
- **Type:** JetBrainsMono Nerd Font, 10 px.
- **Motion in the original:** workspace and taskbar buttons animate `all` with
  `cubic-bezier(.55, -0.68, .48, 1.682)` (a strong anticipate-and-overshoot curve): 0.4 s when a button
  becomes active (its padding grows from 0.3 em to 1.2 em), 0.3 s for hover. Popup menus use a 0.25 s
  fade-in with ease-out. The privacy indicator fades over 250 ms.
- **Character:** compact, rounded, slightly springy. The reference shells (Caelestia, DankMaterialShell)
  add fluid size changes, colour cross-fades and a slow spatial move with a fast fade.

## 8. Motion opportunities

Result of a review of the widgets above against the HyDE look, using the gate *frequency, purpose,
speed, function* (the skill is written for web UIs; the rules carry over, values are QML: durations in
ms, curves as `Motion` tokens). The bar is visible all day, so most of it should stay still.

**Recon.** Stack: Quickshell QML. Existing vocabulary: `core/Motion.qml` (durations `spatialIn/Out`,
`effectsIn/Out`, `reduced`; curves `emphasizedDecel`, `standard`, `effects`) and `Theme.reduceMotion`.
Personality: compact, rounded, slightly springy (the original animates workspace pills with an
overshoot curve). Frequency map: bar is always on screen; hover on entries is tens of times a day;
workspace switching is keyboard-driven (100+ a day); theme or wallpaper changes are occasional;
peeks and panels are occasional to tens a day.

### Part 1: Opportunities

| # | Location | Today | Purpose | Frequency | Suggested motion |
|---|---|---|---|---|---|
| 1 | `core/Theme.qml` colours | a wallpaper or theme change makes the whole bar jump to the new colours | Preventing a jarring change | Occasional | `Behavior` with `ColorAnimation` on `bg fg accent muted warning critical hover`, 300 ms, curve `standard` (`0.2, 0, 0, 1`); disabled until the first theme is applied (no fade from defaults at start); 0 ms with `reduceMotion` |
| 2 | entries in `ModuleHost` | no feedback on hover | Feedback | Tens/day | rounded fill (`Theme.hover`, radius `Theme.radius`) fades in over 120 ms, out over 160 ms, curve `standard`; the pointer only, no scale; matches Waybar's `wb-hvr-bg` |
| 3 | entries that have a click action | none | Feedback | Tens/day | press: `scale 0.97` in 100 ms, release 160 ms, curve `standard`; only where a click does something (weather refresh); `reduceMotion`: no scale |
| 4 | `ModuleHost` width | a changing text (battery 9 % to 10 %, weather text) makes the neighbours jump | Preventing a jarring change | Occasional | `Behavior on width`, 200 ms, curve `standard`; layout neighbours follow because their position derives from the width |
| 5 | bar zones (module added or removed by layout or IPC) | modules appear and vanish, the rest jumps | Preventing a jarring change | Rare | enter: opacity 0 to 1 in 200 ms; exit: 1 to 0 in 150 ms; the remaining entries slide (`displaced`) in 200 ms; all curve `standard`. As a side effect only the changed modules are rebuilt |
| 6 | peek / panel popup (`ScriptView`) | pure slide up | Spatial consistency | Occasional to tens/day | keep the slow slide the user chose (700 ms open, 450 ms close) and add `scale 0.96 to 1` from the trigger edge, fade as now (420 / 350 ms). No overshoot: the popup window clips it and it repeats often |
| 7 | future: month change in the calendar | n/a | Spatial consistency | Occasional | month content slides 24 px and fades, 200 ms, `standard`; direction follows the scroll |
| 8 | future: album art change in the media panel | n/a | Preventing a jarring change | Tens/day | cross-fade 200 ms, `standard`; the seek bar itself does not animate |
| 9 | future: running timer ring | n/a | State indication | Occasional | constant motion, so `linear`, updated once per second; no easing |

**Status (2026-09-30):** rows 1 to 6 are implemented; 7 to 9 belong to widgets that do not exist yet. The popup is now the reusable `Popover` component (`components/Popover.qml`); the weather entry is its first user.

Notes on values: hover and press stay at or below 160 ms because they occur tens of times a day. The
popup slide at 700 ms is deliberately **over** the usual budget (200 to 500 ms for panels) and above the
reference shells' 500 ms: it is the user's explicit choice (first 1000 ms, then reduced to 700 ms). Everything new uses the
budget.

### Part 2: Rejected

- **Workspace switch pill with overshoot** (`cubic-bezier(.55, -0.68, .48, 1.682)`, 0.4 s in the original).
  Rejected: keyboard-initiated and 100+ a day. If the fill of the active pill changes at all it should be
  at most 120 ms with `standard` and no overshoot. This departs from the original look and is the user's
  call.
- **Clock seconds, CPU %, temperatures, throughput numbers tweening or counting.** Rejected: functional
  data the user is reading; motion hinders. Monospace type keeps their width steady.
- **Sparkline or chart drawing animations.** Rejected: information to read, not decoration.
- **Panels opened by keybinding or IPC.** Rejected: keyboard-initiated; open instantly.
- **Bounce on the popup.** Rejected: clipped by the window and repeated too often.
- **Stagger of all pills at every shell start.** Rejected as default: once per session, decorative; could be
  offered as an opt-in once the theme has a motion switch.

### Part 3: Verdict

The bar needs little motion: it is a status display, and the reference shells feel fluid mainly because
state changes are smooth, not because things move constantly. The highest leverage by far is #1 (one
setting in one file and the whole bar cross-fades on a wallpaper change), followed by #2 and #4 which
remove the "stiff" feel. #5 is the most work (it changes how zones are built) but also fixes a known
limitation, the full rebuild on layout changes. Whether the slow popup still feels right next to these
short ones can only be judged by using it. Any row can be turned into a self-contained plan with
`improve-animations plan <row>`.
