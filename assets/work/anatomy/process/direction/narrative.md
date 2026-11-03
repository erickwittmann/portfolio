# Narrative direction: Follow the Power

## Through-line
Press one button and follow it to a picture on the screen. Energy comes in at the wall, gets tamed and shrunk to about one volt, and becomes thinking, memory and then light. Finally it leaves as heat. Each part is one stop, and its copy answers: **what reaches me, what do I do with it, where does it go next?** The finale asks the visitor to retell it: *trace the power from wall to screen.*

## Order: three acts
**I · Energy:** 1 PSU (the wall; the prototype already opens here) → 2 Motherboard (plugs, regulators, the map).
**II · Information:** 3 CPU (power ends at about 1 V, thinking starts) → 4 RAM (the desk) → 5 SSD (the shelves that fill the desk) → 6 GPU (frames leave for the screen: **the peak**).
**III · Heat:** 7 Cooler (every watt is now heat) → 8 Case (pull back to the whole house; its power button loops back to the start and into Build a PC).

Live opens on the GPU (`state.part = 1`). Reorder `PARTS` (or the arrows' order) to open on the PSU. Leave the workshop's assembly order alone: building follows the screwdriver, exploring follows the power. The parts come from mixed platforms, so tell the story of *a* PC (see `fact_questions`).

## The beat of each view
- **Overview: "Meet it."** The part's role in the journey, in one breath. No specs.
- **Framework: "What it's made of."** Name the layers from the outside in, following the dissolve.
- **Power: "What feeds it."** Yellow. Where power enters, how it changes, where it ends. The numbers live here.
- **Data: "Who it talks to."** Magenta. End on the neighbour: that's the handoff.
- **Airflow: "Where the heat goes."** Blue. Say where the air ends up.

One idea per view. If a line names something, the map on screen must show it. The Case's Simple Power and Data lines don't yet; edits 1–2 fix that.

## Handoffs
Each part's last line points to the next stop; the side arrow is the bridge, and `#web` lights the link.
The PSU's "ready!" wakes the board → the board feeds the CPU about 1 V → the CPU's memory channels reach RAM → RAM forgets without power and the SSD doesn't → the SSD puts files on the brain's desk → the GPU sends frames to the screen, then heat → the cooler blows it to the back → the case's button says "wake up!" and the loop restarts.

## Voice
**Simple (default, ages 8–12):** you, present tense, two short sentences at most, one picture, end on a wow. Keep to one family of comparisons: the board is a busy city with copper roads, the regulators are little power stations, the CPU is the brain, RAM is the desk, the SSD is a librarian and shelves, the GPU is tiny workers drawing, and the case is a house that breathes. "Memory" means RAM only.
**Detailed (adults):** role, then how it works, then numbers. Cut "acts as", "responsible for", "excels in" and "ideal for".

## Music
One theme in **A minor**, built from layers that follow the views. The existing sounds are already in key (`boot` 55→220 Hz, `scan` 220/330 Hz, `found` E-A-E, `badge` C-E-G-C-E).
Overview = the theme · Framework = the same bars, muffled · Power = a sub-bass pulse joins · Data = an arpeggio joins · Airflow = a breathy noise pad joins. Swap layers on the next beat, and draw the traces on in time.
Act I is low and sparse. Act II grows to the **full arrangement on the GPU's Data view**. Act III slows and opens out. The Case's Data view resolves to the home chord.

## Whooshes and rests
A whoosh means moving through space, a scan means crossing the skin, a rest means reading.

| UI moment | Sound |
|---|---|
| `#intro`, "Loading parts" | Silent: browsers block audio until the first click. |
| "Click to Start Experience" → the part drifts in | **First downbeat on the click**, with a long whoosh under the drift. |
| Part change (arrows, parts bar, index, web; 1.05 s slide) | Whoosh panned with the slide, peaking as the parts cross. The music never restarts; a new act shifts key on the next bar. At most one whoosh per 300 ms. |
| Overview ↔ x-ray (`#modes`; 1.1 s scan, or 0.42 s dissolve in the prototype) | Scan sweep down on the way in and up on the way out; the muffling follows it. |
| Between x-ray views | **No whoosh**: swap layers, play a tick. |
| Hotspot fly-in and callout | **Rest**: music dips about 6 dB, plus a soft whoosh and the `found` chime. |
| "★ You found everything…" | Badge sting on the beat. |
| Take it apart / Size line-up | A mechanical spread with the music thinned / the widest whoosh with the full theme. |
| Build a PC | A lighter loop where each "Click!" is percussion. **Power on**: one beat of silence, then the full theme on "It's alive!". A failed start gets silence and a thud. |
| `#celebrate` | The theme returns at its biggest. |
| `#home` glitch, or the prototype exit (0:18) | Tape-stop into the glitch, silence on the black, then the drone returns with the title. |

Respect the `#sound` mute. Rest while the glossary is open.

## For the wires
Draw each trace from its upstream end (plug → regulator → chip), one bar per trace, in the order the sentence reads. Data pulses run both ways only where the map says `both`.
