# Style direction: real wires, air, calm motion

Exact values are in `style.json`, and audio picks are in `audio-candidates.json`.

## a. Wires: an angiogram
In the x-ray views the cyan ghost is the tissue. The wires are the only solid, lit things in the frame, with the flow colour as contrast dye inside them. At rest, a wire looks like real copper, PVC or nylon. Flow is light inside the conductor, never a separate glowing tube.

| Class | Look (MeshPhysicalMaterial) | Size (18 AWG = 1) | Drape / routing |
|---|---|---|---|
| PCB traces (board, GPU, RAM, SSD) | Bare copper `#e9a47c`, metalness 1, roughness .3, clearcoat .6 | Flat ribbon, 0.55 / 1.1 mm drawn | 45° mitres, never 90°. Diff pairs, serpentines on memory and PCIe lanes |
| Power planes | `#d9926a`, roughness .45, cross-hatched so the ghost shows through | 0.08 mm | Rounded pours |
| CPU substrate | Darker copper `#c98a5e` | 0.12 mm | Radial fan-out, via dots |
| PSU cables | ATX colour code. Roughness .38, clearcoat .3, IOR 1.53 | 2.1 mm (1) | Behind the tray and out a grommet. Sag 3%, bend ≥ 5× OD, combs every 70 mm, no twist |
| Sleeved / braided | Sheen 1 with a woven normal map / black PET mesh, 25% open, glossy heat-shrink ends | 1.7 / 14 × 8 mm bundle | Combs every 60 mm |
| Fan cable | Black, yellow, green, blue | 0.6 | 10% droop |
| Front panel | Twisted pairs, 20 mm lay | 0.6 | Loose |
| USB and audio headers | Matte jackets | 1.7–2.8 | USB 3 is stiff: 1.5% sag |
| Connectors | Mini-Fit Jr (4.2 mm): black or natural nylon, alternating square and D-shaped cavities, tin terminals | | |

**Flow** travels as soft packets, brightest where the wire faces the camera, with the insulation colour at the rim. **Power** is long, slow swells (about 6 s across the motherboard). **Data** is short packets at twice that speed. Planes ripple outward from where power enters. Ground wires carry a faint return pulse running backwards. In the Data view, only the green PS_ON# wire inside the 24-pin bundle pulses toward the PSU, and the grey PWR_OK wire pulses back: one bundle, different jobs. Cables stay visible at rest in the other mode; board traces of the other mode drop to 25%.

**Inside the ghost:**
1. Wires get the ghost's own fresnel rim (`XR.tint`), so their silhouettes match.
2. Wires draw first, so ghost surfaces in front veil them in cyan.
3. The scan's clipping plane reveals wires with the ghost.
4. Insulation colours are muted in x-ray; only cyan and the flow colour stay saturated.
5. A halo shell replaces bloom (the prototype needs its `GLOW` blending).
6. Each wire draws on from its upstream end (700 ms, 140 ms stagger).

## b. Sound and music
**Air, not electronics:** recorded breath, air and soft taps over one slow ambient bed that never restarts. Transitions are swells inside it.
- **Key and tempo:** A minor (`narrative.md`), 60–72 bpm. Music changes snap to the beat; effects never wait.
- **Instruments:** warm pads and bowed guitar, at most a felt piano or cello. No drums, risers or arpeggios.
- **Loudness:** the bed at −23 LUFS, whooshes about 5 dB above it, ticks at −28 LUFS. A limiter keeps peaks under −1 dBTP. Duck the bed 6 dB under callouts.
- **No clicks:** ramp every gain change. Loop by crossfading two sources (MP3 padding breaks `loop = true`). Fade out when the tab hides.

| Moment | Sound |
|---|---|
| Start | The bed fades in over 4 s under a long air rush |
| Part slide | A stereo whoosh panned with the slide |
| Photo ↔ x-ray | A windy swell while the bed muffles (reversed on the way out) |
| X-ray ↔ x-ray | A soft mouse click |
| Hotspot | A breath swoosh; the bed ducks |
| Discovery | Two cardboard taps |
| Take apart | A whisper whoosh (reversed to reassemble) |
| Badge | The bed swells |
| Exit glitch | Tape stop, then silence |

## c. Motion fluidity
| # | Where | Problem | Fix |
|---|---|---|---|
| 1 | Live: part change | The outgoing part snaps back from the user's turn in about 0.1 s (damp λ 30) | Ease it out on the slide curve |
| 2 | Live: Power ↔ Data | Graphs swap instantly through one shared `uOpacity`; the ghost's rim and tint jump | Crossfade each graph (250 ms out, 450 ms in); tween the `XR` uniforms |
| 3 | Live: any mode change | `.bg` gradients can't transition, so they hard-cut | Crossfade one stacked layer per mode |
| 4 | Live: photo ↔ x-ray | The flash hits 85% in 140 ms | Keep it at 25% or less over 900 ms, or drop it |
| 5 | Live: idle | 30 fps frame skipping makes the sway judder | Lower the pixel ratio instead; make inertia time-based |
| 6 | Live: flow labels | They pop back after a slide | Fade them with the flows |
| 7 | Live: hotspot focus | Rotation (λ 8) finishes before the zoom (λ 5) | Use λ 4 for both |
| 8 | Prototype: part change from x-ray | Hard-cuts to the photo look | Dissolve first |
| 9 | Prototype: clicks during a slide | Dropped | Queue the latest |
| 10 | Prototype: hotspot rings | Vanish, then return 1.5 s late | Fade them out and in around the slide |
| 11 | Prototype: dissolve | 0.42 s linear stops dead; the background snaps | 650 ms ease-out |
| 12 | Prototype: callout close | Instant | 180 ms fade |
