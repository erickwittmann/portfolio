# Hardware audit for the wire views (2026-10-30)

Source ids in [brackets] are entries in `sources.json`. Pin-level data is in `wiring.json`.

## Settled: the 4000D Airflow's fans
It ships with **one 120 mm intake fan at the front and one 120 mm exhaust fan at the rear**, not two at the front. TechPowerUp lists "front 3×120 mm (1 pre-installed), rear 1×120 mm (1 pre-installed)" [tpu-4000d-airflow-outside]. Corsair's page only says "two AirGuide fans" and sells the stock fan as a 3-pin part [corsair-4000d-airflow]. **Fix:** the case airflow copy, the intake hotspot and LAYERS "Front fans: Three fans…". Wire both fans as 3-pin.

## Copy and flows: wrong, imprecise or unsourced
**Motherboard**
- `atx24>dimm`, `atx24>pch`: the 24-pin does not feed these directly. Onboard regulators make DRAM VDDQ (1.2 V, which also powers the CPU's memory controller), VccSA, VccIO and the other rails [intel-cfl-datasheet-vol1]. Add a "DRAM VR" node; its input rail is unsourced.
- VRM: **10 phases**, an ASP1400BT controller and 10 high-side + 10 low-side MOSFETs under two heatsinks, with no heat pipe [kitguru-z370e]. How the phases split between cores and iGPU is unsourced. The EPS feeds VCC and VccGT, both under SVID control [intel-cfl-datasheet-vol1].
- The CPU's PCIe is Gen 3 only and splits 1×16, 2×8 or 1×8+2×4 [intel-cfl-datasheet-vol1]. **In this build the RTX 3080 and the 980 PRO both link at PCIe 3.0.** The "4.0" on their nodes is what the parts can do.
- M.2_1 is PCIe x4 or SATA, and a SATA drive there turns off SATA_1. M.2_2 is PCIe x4 only and turns off SATA_5/6 [asus-z370e-manual-f13238]. Make the hotspot this specific.
- `pch>usb`: the Z370 has no native USB 3.1 Gen 2 [pchardware-z370]. The rear Gen 2 Type-A/C ports and the front Gen 2 header come from **two ASMedia ASM3142** controllers [kitguru-z370e]. Using the front header disables PCIE_x1_2 and PCIE_x1_4 [asus-z370e-spec].
- The rear I/O hotspot leaves out DVI-D, optical S/PDIF and the Gen 1 and USB 2.0 ports. Wi-Fi is a Realtek RTL8822BE module; Bluetooth is 4.2 per ASUS, 4.1 per KitGuru [asus-z370e-spec, kitguru-z370e].
- Memory uses ASUS "T-Topology", with equal-length branches to both DIMMs of a channel [anandtech-z370-overview]. I could not text-verify the A2/B2 advice.

**GPU**
- "Copper cold plate" should be a **vapour chamber**, with four heat pipes and two 85 mm fans [tpu-rtx3080fe-teardown].
- VRM: **15 GPU phases** (MPS controllers, MP86957 DrMOS) plus **3 memory phases** (uS5650Q) [tpu-rtx3080fe-pcb], 18 in all [hexus-rtx3080fe]. The NVVDD/MSVDD split is unsourced.
- `die>mem` is **ten separate 32-bit links**, one to each Micron MT61K256M32JE-19 chip (PAM4) [tpu-rtx3080fe-pcb].
- 300 W through the 12-pin plus 75 W from the slot gives 375 W available [tpu-rtx3080fe-teardown]. The PCB ends at the 12-pin [hexus-rtx3080fe].
- Prototype fan hotspot: the fan pushes air out above the card toward the CPU cooler, not "out through the top of the case" [tpu-rtx3080fe-teardown].

**CPUs**
- **Live-build conflict:** the Ryzen 5 3600 (AM4, 1,331 pins) cannot fit the Z370-E's LGA1151 socket, yet the workshop drops it in.
- 7950X3D: AM5 gives up to 24 lanes for slots and storage (x16 plus **two** x4), and PCIe 5.0 speed depends on the board. The chipset link is a separate **PCIe 4.0** x4 [anandtech-ryzen7000, wikipedia-am5]. The prototype draws only one NVMe x4.
- `ccd>iod` "pairs": I found no source on Infinity Fabric's on-package signalling, so treat "pairs" as visual only. SVI2 and the rail names were not re-verified.

**RAM** checks out [kingston-ddr4-udimm]. Each byte lane is 8 DQ plus a DQS pair plus DM/DBI [amd-ug583-ddr4-dimm-constraints]. "64 ms refresh" was not re-verified.

**Storage:** two 4 Tbit NAND packages, 8 channels at 1,400 MT/s, 1 GB LPDDR4-1866 [techpowerup-980pro-db]. TechPowerUp **lists no PMIC**, although credits.html cites it for one. The 4 + 4 channel split is unsourced.

**Cooler:** pin order confirmed (GND, PWR, IN, PWM; 1 A maximum) [asus-z370e-manual-f13238]. No source gives the Cooler Master fan's colours.

**PSU:** change "about 400 V" to "about 380–400 V" [infineon-800w-pfc, hwbusters-rm850x]. `llc>sr` is the **transformer**: nothing copper crosses it, and on/off and power-good cross the barrier through an opto-coupler [onsemi-and8474].

**Case:** front I/O is USB-C, USB 3.0, a combo audio jack, and **power and reset** buttons. There is **no HDD LED** [corsair-4000d-airflow, tpu-4000d-airflow-outside, tpu-4000d-airflow-inside].

## harness.js and link kinds
- **atx24**: pin order and colours are correct. **Missing:** the brown +3.3 V sense wire crimped into pin 13 with the orange one. Both pin-13 wires are 22 AWG; all the others are 18 AWG [intel-atx3-psdg-336521, intel-atx12v-psdg-2.2].
- **eps8, pcie8**: correct [intel-atx3-psdg-336521]. pcie8 pins 4 and 6 are SENSE1/SENSE0, grounded in the plug.
- **nv12**: the 3.0 mm pitch and 6 + 6 layout are right, with no sideband pins [mdpcx-nv12-connector, moddiy-rtx30-12pin, videocardz-12pin-12vhpwr]. NVIDIA never published pin numbers; "1–6 +12 V" is the 12V-2x6 convention. od 2.2 is above MDPC-X's 2.0 mm limit.
- **Case `psu>gpu`** draws one pcie8 cable; the FE needs **two** 8-pin cables into its adapter [tpu-rtx3080fe-teardown, moddiy-rtx30-12pin].
- **fan4**: correct [noctua-fan-pinout-faq]. Add a **fan3** harness for the case fans (black GND, red +12 V, yellow tach). Yellow is the tach wire on a 3-pin fan but +12 V on a 4-pin one.
- **pwrsw**: the 4000D's cables are all black, so the white wire is wrong [tpu-4000d-airflow-inside]. Add a reset lead (Intel pins 5/7) [intel-fpio-600569].
- **usb3**: the 4000D's cable is **flat and black** [tpu-4000d-airflow-inside]. Inside are 4 shielded SuperSpeed pairs, 2 USB 2.0 pairs and power/ID wires, at 90 ± 7 Ω [intel-usb3-icc-spec]. **Add the USB-C cable** to the U31G2_E3 header [asus-z370e-manual-f13238].
- **Unverified:** the 2.54 mm pitches, all `od` values, and everything in the PSU-internal acin/dc12/dc5/vsb/sig harnesses (colours, and whether those links are wires at all). Prefer `pour` for `sr>ports` and `dcdc>ports`.
- Kinds: `storage ctrl>nand*` is a parallel Toggle bus, so `ddr` fits better than `trace`. The other kinds are right.

## Realism points for drawing wires
1. **Power on a PCB moves through planes and pours on several layers, joined by many vias, not through single traces.** Intel asks for "multiple power and ground planes" [intel-cfl-datasheet-vol1]. Draw VRM→socket as broad stacked copper.
2. **High-speed pairs:** two tightly coupled traces matched in length (serpentine at the mismatched end) over a solid ground plane, with small in-line AC-coupling capacitors [ti-spraar7j]. PCIe x16 is 32 pairs plus REFCLK [wikipedia-pcie].
3. **DDR4:** byte lanes travel as groups matched to their strobe (about ±10 ps), with wider gaps between bytes than within one [amd-ug583-dimm-data].
4. **Cables:** 18 AWG wires carry 6–8 A per pin at 4.2 mm pitch [intel-atx3-psdg-336521]. Each SATA supply wire bridges three pins [wikipedia-sata].
5. **The PSU's isolation gap:** only the transformer and opto-couplers cross it [onsemi-and8474].

## Source health
The AnandTech links (14525, 17399) now redirect to its forum; use the Wayback copies in sources.json. The cpu-monkey URL has moved. I could not re-open Igor's Lab, Intel's PWM PDF mirror, the Noctua white paper or the Advantech PDF. pinouts.ru shows pin 20 as −5 V and puts the 22 AWG wire on "pin 11"; follow Intel.
