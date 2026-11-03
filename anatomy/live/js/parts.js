/* Content + model setup for every part.
   Anchors and flow paths are in "box space": fractions of the part's oriented bounding box, each axis -0.5…0.5
   (x = left→right, y = bottom→top, z = back→front as the part first faces the camera). */

export const MODES = [
  { id: "overview",  label: "Overview",  key: "1" },
  { id: "framework", label: "Framework", key: "2" },
  { id: "power",     label: "Power",     key: "3" },
  { id: "data",      label: "Data",      key: "4" },
  { id: "airflow",   label: "Airflow",   key: "5" },
];

// the case's 24-pin cable: out of the PSU, behind the motherboard tray, through the grommet beside the board
const ROUTE_24 = [[-0.08, -0.36, -0.46], [0.17, -0.22, -0.46], [0.18, 0.17, -0.46], [0.17, 0.19, -0.36]];
// the cooler's fan cable: out of the hub along a strut to the frame's corner, then down to the board
const FAN_ROUTE = [[0.42, -0.36, 0.38], [0.36, -0.12, 0.42]];

export const PARTS = [
  {
    id: "mthr", ghost: "MTHR", icon: "ic-motherboard.svg",
    title: ["MOTHERBOARD", ""], model: "ASUS ROG Strix Z370-E Gaming",
    explode: {
      mats: [
        [/^Ram/, [0, 0, 0.18], "Memory sticks"],
        [/^CPULid|^CPU_Base/, [0, 0, 0.26], "Processor"],
        [/I_O_Cover/, [-0.06, 0, 0.22], "I/O cover"],
        [/BoardM2Cover/, [0, 0, 0.2], "Heatsink covers"],
        [/^M2_/, [0, -0.02, 0.14], "M.2 SSD"],
        [/Battery/, [0, 0, 0.16], "CMOS battery"],
        [/CPULatch|CPUBracket/, [0, 0.03, 0.18], "Socket latch"],
      ],
    },
    glb: "motherboard.glb", size: 3.8, basis: ["x", "y", "z"], tilt: [-0.5, -0.45],
    modes: {
      overview:  "The motherboard is where every part meets. Its copper traces carry power from the PSU and data between the CPU, RAM and graphics card.",
      framework: "A layered fibreglass board with copper traces between its layers. On top: an Intel LGA1151 socket, four DDR4 slots, three PCIe x16 slots, two M.2 slots, and the Z370 chipset under the heatsink at the bottom right.",
      power:     "The 24-pin plug brings 12 V, 5 V and 3.3 V; small regulators on the board make the memory and chipset rails, and each graphics slot gets up to 75 W. The CPU has its own 8-pin feed: 12 V that a 10-phase regulator beside the socket steps down to about one volt.",
      data:      "The CPU talks straight to the memory (two DDR4 channels) and the graphics slots (16 PCIe 3.0 lanes). Everything else — both M.2 slots, six SATA ports, USB, Ethernet, Wi-Fi and audio — goes through the Z370 chipset, which shares one DMI 3.0 link back to the CPU.",
    },
    hotspots: [
      { id: "socket", mat: "CPU_BaseM", title: "CPU Socket", text: "An Intel LGA1151 socket: the springy pins are in the socket, and the CPU's flat pads press down onto them. This one holds a Core i7-9700K." },
      { id: "ram",    mat: "Ram3M", title: "Memory Slots", text: "Four DDR4 slots on two channels. ASUS wires each channel to its two slots on equal-length branches, a layout it calls T-Topology." },
      { id: "m2",     mat: "M2_BaseM", title: "M.2 Slot", text: "M.2_1 takes a PCIe 3.0 x4 or a SATA drive from the chipset; a SATA drive here switches off SATA port 1. The second M.2 slot is PCIe only and shares SATA ports 5 and 6." },
      { id: "cmos",   mat: "BatteryM", title: "CMOS Battery", text: "A coin battery, like the one in a watch, keeps the clock ticking and your settings saved while the PC is unplugged." },
      { id: "io",     mat: "I_O_Cover", title: "Rear I/O", text: "USB 3.1 Gen 2 Type-A and Type-C (from two ASMedia chips), Gen 1 and USB 2.0 ports, Intel Gigabit Ethernet, Wi-Fi antennas, audio with optical S/PDIF, and HDMI, DisplayPort and DVI-D for the CPU's graphics." },
    ],
    // positions: the model's own parts where it names them; slot and header spots read off the board's layout
    flows: {
      plane: -0.46,   // just above the PCB
      nodes: {
        psu24: { at: [0.7, 0.0] }, psuEps: { at: [-0.4, 0.68] },   // the PSU's cables arrive from off the board
        atx24: { at: [0.46, 0.18], label: "24-pin ATX", simple: "Main power plug", note: "12 V · 5 V · 3.3 V" },
        eps:   { at: [-0.24, 0.46], label: "8-pin EPS", simple: "CPU power plug", note: "12 V" },
        vrmT:  { mat: "BoardPlate2m", label: "VRM", simple: "Power stages", note: "10 phases · 12 V → ≈1 V" },
        vrb:   { at: [0.42, 0.0], label: "Board regulators", simple: "Small power stations", note: "DRAM 1.2 V · chipset rails" },   // placement schematic
        vrmL:  { mat: "BoardPlate1m" },
        cpu:   { mat: "CPU_BaseM", label: "CPU", simple: "Brain", note: { power: "Vcore", data: "Core i7-9700K" } },
        dimm:  { mat: "Ram3M", label: "DDR4 slots", simple: "Memory", note: { power: "1.2 V", data: "2 channels" } },
        x16a:  { at: [-0.2, -0.09], label: "PCIe x16_1", simple: "Graphics slot", note: { power: "≤ 75 W" } },
        x16b:  { at: [-0.2, -0.29], label: "PCIe x16_2", note: { power: "≤ 75 W" } },
        x16c:  { at: [-0.2, -0.41], label: "PCIe x16_3", note: "x4 from chipset" },
        pch:   { mat: "BoardChipsetM", label: "Z370 chipset", simple: "Helper chip", note: { data: "PCH" } },
        m2a:   { mat: "M2_BaseM", label: "M.2_1", simple: "SSD slot", note: { power: "3.3 V", data: "PCIe 3.0 x4" } },
        m2b:   { at: [0.17, -0.37], label: "M.2_2", note: "PCIe 3.0 x4" },
        sata:  { at: [0.46, -0.3], label: "SATA ×6", simple: "Drive ports", note: "6 Gb/s" },
        usb:   { mat: "USB3M", label: "USB · LAN", simple: "Back ports", note: "Intel I219V · ASMedia USB 3.1 Gen 2" },
        wifi:  { mat: "AntennaM", label: "Wi-Fi", note: "802.11ac + BT 4.2" },
        audio: { at: [-0.36, -0.22], label: "Audio codec", simple: "Sound chip", note: "SupremeFX S1220A" },
      },
      power: [
        ["psu24", "atx24", 0, { kind: "cable", harness: "atx24", plug: "to", axis: "y", via: [[0.58, 0.1]], fade: "from" }],
        ["psuEps", "eps", 0, { kind: "cable", harness: "eps8", plug: "to", axis: "x", via: [[-0.32, 0.58]], fade: "from" }],
        ["eps", "vrmT", 3, { label: "12 V" }], ["eps", "vrmL", 2], ["vrmT", "cpu", 3], ["vrmL", "cpu", 3],
        ["atx24", "vrb", 3], ["vrb", "dimm", 2, { label: "1.2 V" }], ["vrb", "pch", 2], ["atx24", "m2a", 2, { label: "3.3 V" }],
        ["atx24", "x16a", 3, { label: "12 V + 3.3 V" }], ["atx24", "x16b", 2],
      ],
      data: [
        ["cpu", "dimm", 6, { kind: "ddr", both: true, label: "DDR4 · 2 × 64-bit" }],
        ["cpu", "x16a", 4, { kind: "pairs", both: true, label: "PCIe 3.0 x16 (x8/x8)" }], ["cpu", "x16b", 2, { kind: "pairs", both: true }],
        ["cpu", "pch", 4, { kind: "pairs", both: true, label: "DMI 3.0 ≈ 3.9 GB/s" }],
        ["pch", "m2a", 4, { kind: "pairs", both: true }], ["pch", "m2b", 4, { kind: "pairs", both: true }], ["pch", "x16c", 4, { kind: "pairs", both: true }],
        ["pch", "sata", 2, { kind: "pairs", both: true }], ["pch", "usb", 2, { kind: "pairs", both: true, label: "USB · Ethernet" }],
        ["pch", "wifi", 1, { kind: "pairs", both: true }], ["pch", "audio", 2, { both: true, label: "HD Audio" }],
      ],
    },
  },
  {
    id: "gpu", ghost: "GPU", icon: "ic-gpu.svg",
    title: ["GRAPHICS", "PROCESSING UNIT"], model: "Nvidia RTX 3080",
    explode: {
      auto: true,
      labels: {
        body: "Shroud", cover: "Cover plate", heatsink_front: "Heatsink fins", heatsink_back: "Heatsink fins",
        motherboard: "Circuit board", back_shield: "Backplate", ports: "Display ports", heatpipes: "Heat pipes",
        coldplate: "Vapour chamber", "12_pin": "12-pin power", Armature: "Fans", fan_holder: "Fan frame",
      },
    },
    glb: "gpu.glb", size: 4.6, basis: ["-z", "-x", "y"], tilt: [-0.28, -0.5], fans: true,
    modes: {
      overview:  "The GPU, or Graphics Processing Unit, is the last stop before your screen: thousands of cores work in parallel on games, 3D rendering and AI.",
      framework: "Under the shroud: a short circuit board carrying the GA102 chip, ten GDDR6X memory chips and their power stages, with a vapour chamber, four heat pipes and fin stacks on top. The board stops partway, so the rear fan can blow straight through the card.",
      power:     "The hungriest part here: up to 320 W, most through its 12-pin plug and up to 75 W through the PCIe slot. Eighteen power stages step the 12 V down: fifteen for the GPU core, three for the memory.",
      data:      "Work arrives over 16 PCIe 4.0 lanes (3.0 on the Z370 board here). The GA102's 8,704 CUDA cores reach 10 GB of GDDR6X over ten 32-bit links, about 760 GB/s, and frames leave through one HDMI 2.1 and three DisplayPort 1.4a outputs.",
      airflow:   "Two fans work as a team: one pushes air through the fins and out of the case, the other pulls air straight through the card's open back.",
    },
    hotspots: [
      { id: "ports", node: "ports", n: [-1, 0, 0.35], title: "Display Ports", text: "One HDMI 2.1 and three DisplayPort 1.4a outputs: up to four screens at once." },
      { id: "power", node: "12_pin", n: [0, 1, 0.5], title: "12-pin Power", text: "A compact 12-pin plug (an adapter takes two 8-pin cables) feeds most of the card's 320 watts." },
      { id: "fan",   node: "fan", n: [0, 0, 1], title: "Axial Fan", text: "Fans pull air through the heatsink fins, carrying heat away from the GPU die and out of the card." },
      { id: "core",  node: "coldplate", n: [0, 0, 1], title: "GPU Die & Vapour Chamber", text: "The GA102 chip sits under a vapour chamber that spreads its heat into four heat pipes and the fins." },
    ],
    // the die is under the cold plate; the memory ring and power stages surround it (not modelled, so placed beside it)
    flows: {
      plane: -0.3,   // the circuit board, under the shroud
      nodes: {
        psu12: { node: "12_pin", off: [0.06, 0.34] },   // the cable from the PSU, arriving from above
        pin12: { node: "12_pin", label: "12-pin power", simple: "Power plug", note: "12 V" },
        slot:  { at: [-0.2, -0.49], label: "PCIe edge", simple: "Slot fingers", note: { power: "≤ 75 W", data: "PCIe 4.0 x16" } },
        vrm:   { mix: ["coldplate", "12_pin", 0.5], label: "Power stages", note: "15 core + 3 memory phases" },
        die:   { node: "coldplate", label: "GA102", simple: "Graphics chip", note: { power: "GPU core", data: "8,704 CUDA cores" } },
        mem:   { node: "coldplate", off: [0.12, -0.2], label: "GDDR6X ×10", simple: "Video memory", note: "10 GB" },
        ports: { node: "ports", label: "Outputs", simple: "Screen ports", note: "HDMI 2.1 + 3× DP 1.4a" },
      },
      power: [
        ["psu12", "pin12", 0, { kind: "cable", harness: "nv12", plug: "to", axis: "x", out: [0, 1, 0], via: [[0.11, 0.62]], fade: "from" }],
        ["pin12", "vrm", 4, { label: "up to 320 W" }], ["slot", "vrm", 2, { label: "≤ 75 W" }],
        ["vrm", "die", 4], ["vrm", "mem", 2, { label: "memory rail" }],
      ],
      data: [
        ["slot", "die", 4, { kind: "pairs", both: true, label: "PCIe 4.0 x16" }],
        ["die", "mem", 10, { kind: "ddr", both: true, label: "10 × 32-bit · 760 GB/s" }],
        ["die", "ports", 4, { kind: "pairs" }],
      ],
    },
    airflow: { dir: [0, 0, -1], spread: [0.9, 0.7], spin: 3.2 },
  },
  {
    id: "cpu", ghost: "CPU", icon: "ic-cpu.svg",
    title: ["CENTRAL", "PROCESSING UNIT"], model: "AMD Ryzen 5 3600",
    glb: "cpu.glb", size: 2.7, basis: ["-y", "z", "-x"], tilt: [-0.75, -0.45],
    modes: {
      overview:  "The Central Processing Unit, or CPU, is the computer's \"brain\": it fetches every program's instructions and carries them out, billions each second.",
      framework: "Two chiplets sit under the heat spreader on a layered substrate: a 7 nm compute die with six Zen 2 cores and 32 MB of L3 cache, and a 12 nm I/O die with the memory and PCIe controllers. The substrate fans their connections out to 1,331 pins.",
      power:     "The motherboard feeds two separate rails through the pins: one for the cores (VDDCR_CPU) and one for the I/O die (VDDCR_SOC). The CPU tells the regulators exactly what voltage it wants, moment to moment, within a 65 W budget.",
      data:      "The cores reach everything through the I/O die, over AMD's Infinity Fabric. From there: two DDR4-3200 channels to memory, 16 PCIe 4.0 lanes to the graphics card, 4 to an NVMe SSD and 4 to the chipset.",
    },
    hotspots: [
      { id: "tab",  at: [-0.44, 0.44, 0.5], title: "Corner Triangle", text: "This little gold triangle helps you line the CPU up with the socket so it only fits one way." },
      { id: "ihs",  at: [0.05, 0.05, 0.5], title: "Heat Spreader", text: "The metal lid protects the silicon and spreads its heat evenly into the cooler above it." },
      { id: "pins", at: [0.47, -0.3, -0.2], title: "Pins", text: "1,331 tiny gold pins on the underside drop into matching holes in the motherboard socket." },
    ],
    // dies are hidden under the heat spreader: their placement is schematic, the connections are not
    flows: {
      nodes: {
        vcore: { at: [-0.46, 0.3], label: "Core rail", simple: "Power in", note: "VDDCR_CPU" },
        vsoc:  { at: [0.46, -0.3], label: "SoC rail", simple: "Power in", note: "VDDCR_SOC" },
        ccd:   { at: [-0.16, 0.16], label: "Compute die", simple: "Thinking chip", note: { power: "6 cores", data: "6 cores · 32 MB L3" } },
        iod:   { at: [0.1, -0.14], label: "I/O die", simple: "Traffic chip", note: { data: "memory + PCIe" } },
        mem:   { at: [0.46, 0.22], label: "Memory pins", simple: "To memory", note: "DDR4-3200 × 2" },
        gfx:   { at: [0.08, -0.47], label: "Graphics lanes", simple: "To graphics card", note: "PCIe 4.0 x16" },
        nvme:  { at: [-0.3, -0.47], label: "NVMe lanes", note: "PCIe 4.0 x4" },
        chip:  { at: [0.38, -0.47], label: "Chipset link", note: "PCIe 4.0 x4" },
      },
      power: [["vcore", "ccd", 4, { label: "cores" }], ["vsoc", "iod", 3, { label: "I/O die" }]],
      data: [
        ["ccd", "iod", 2, { kind: "pairs", both: true, label: "Infinity Fabric" }],
        ["iod", "mem", 4, { kind: "ddr", both: true, label: "2 × 64-bit" }],
        ["iod", "gfx", 4, { kind: "pairs", both: true }], ["iod", "nvme", 2, { kind: "pairs", both: true }], ["iod", "chip", 2, { kind: "pairs", both: true }],
      ],
    },
  },
  {
    id: "ram", ghost: "RAM", icon: "ic-ram.svg",
    title: ["RANDOM ACCESS", "MEMORY"], model: "DDR4 Memory Stick",
    glb: "ram.glb", size: 4.2, basis: ["-z", "y", "x"], tilt: [-0.25, -0.5],
    modes: {
      overview:  "RAM is the computer's short-term memory. It holds what the CPU is using right now, loaded from storage so it's reachable almost instantly.",
      framework: "Eight DRAM chips, each 8 bits wide, are soldered to a thin circuit board — side by side they make one 64-bit-wide rank. A tiny SPD chip stores the stick's speeds and timings, and 288 gold fingers plug into the slot.",
      power:     "1.2 V (VDD) comes in through the gold fingers and spreads across a copper plane to every chip. A separate 2.5 V supply (VPP) drives the chips' word lines.",
      data:      "Each chip has its own eight data lines straight to the fingers. Commands and addresses share one 'fly-by' route that visits the chips in turn, end to end. At start-up the motherboard reads the SPD chip over the SMBus to learn how to drive the stick.",
    },
    hotspots: [
      { id: "chips",   at: [-0.3, 0.12, 0.5], title: "Memory Chips", text: "Each DRAM chip stores billions of bits as charges in tiny capacitors, which leak, so every row is refreshed every 64 milliseconds." },
      { id: "fingers", at: [0.32, -0.45, 0.5], title: "Gold Fingers", text: "288 gold contacts slide into the motherboard slot. Gold doesn't rust, so the connection stays clean." },
      { id: "notch",   at: [0.09, -0.45, 0.5], title: "Key Notch", text: "The off-centre notch stops you from putting the stick in backwards or into the wrong kind of slot." },
    ],
    flows: {
      nodes: {
        c1: { at: [-0.39, 0.1], label: "DRAM chip", simple: "Memory chip", note: { power: "VDD + VPP", data: "8 bits wide" } },
        c2: { at: [-0.28, 0.1] }, c3: { at: [-0.18, 0.1] }, c4: { at: [-0.08, 0.1] },
        c5: { at: [0.1, 0.1] }, c6: { at: [0.2, 0.1] }, c7: { at: [0.3, 0.1] }, c8: { at: [0.41, 0.1] },
        d1: { at: [-0.39, -0.44], label: "Data pins", simple: "Gold fingers", note: "DQ" },
        d2: { at: [-0.28, -0.44] }, d3: { at: [-0.18, -0.44] }, d4: { at: [-0.08, -0.44] },
        d5: { at: [0.1, -0.44] }, d6: { at: [0.2, -0.44] }, d7: { at: [0.3, -0.44] }, d8: { at: [0.41, -0.44] },
        ca:   { at: [0.0, -0.44], label: "Command / address", simple: "Instructions in", note: "fly-by" },
        term: { at: [0.47, 0.32], label: "Termination", note: "VTT" },
        spd:  { at: [0.0, -0.15], label: "SPD chip", simple: "Name-tag chip", note: "SMBus" },
        vdd:  { at: [-0.25, -0.44], label: "VDD pins", simple: "Power in", note: "1.2 V" },
        rail: { at: [-0.25, -0.27] }, b1: { at: [-0.39, -0.27] }, b8: { at: [0.41, -0.27] },
        ...Object.fromEntries([2, 3, 4, 5, 6, 7].map((i) => [`b${i}`, { at: [[0, 0, -0.28, -0.18, -0.08, 0.1, 0.2, 0.3][i], -0.27] }])),
      },
      power: [
        ["vdd", "rail", 4, { label: "VDD plane" }], ["rail", "b1", 4], ["rail", "b8", 4],
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => [`b${i}`, `c${i}`, 1]),
      ],
      data: [
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => [`d${i}`, `c${i}`, 3, { kind: "ddr", both: true, label: i === 1 ? "8 × 8 = 64-bit" : "" }]),
        ["ca", "c1", 3, { label: "fly-by" }], ...[1, 2, 3, 4, 5, 6, 7].map((i) => [`c${i}`, `c${i + 1}`, 3]), ["c8", "term", 3],
        ["ca", "spd", 2, { both: true }],
      ],
    },
  },
  {
    id: "storage", ghost: "SSD", icon: "ic-storage.svg",
    title: ["STORAGE", "DRIVE"], model: "Samsung 980 Pro NVMe SSD",
    glb: "ssd.glb", size: 4.2, basis: ["x", "y", "z"], tilt: [-0.6, -0.5],
    modes: {
      overview:  "Storage keeps your files, apps, and operating system, even when the power is off. Solid-state drives read and write far faster than spinning disks.",
      framework: "An M.2 2280 board, 22 × 80 mm. Under the label: Samsung's Elpis controller, 1 GB of LPDDR4 cache and two packages of V-NAND flash.",
      power:     "3.3 V arrives through the M.2 connector, and regulators on the board turn it into the lower voltages the controller, cache and flash need. Unplugged, the flash keeps its data with no power at all.",
      data:      "Data arrives over four PCIe 4.0 lanes (3.0 on the Z370 board) using NVMe. The Elpis controller spreads it across eight 1,400 MT/s channels to the flash and keeps its map of where everything lives in the LPDDR4 cache — up to 7,000 MB/s reading and 5,000 MB/s writing.",
    },
    hotspots: [
      { id: "ctrl",  at: [0.25, 0.0, 0.5], title: "Controller", text: "Samsung's 8 nm Elpis controller: it decides where every block lives, spreads wear evenly across the flash and corrects errors." },
      { id: "nand",  at: [-0.25, 0.0, 0.5], title: "Flash Memory", text: "Samsung V-NAND stores 3 bits in every cell (TLC), in layers stacked like the floors of a building. It keeps your data with no power at all." },
      { id: "key",   at: [0.49, 0.0, 0.3], n: [1, 0, 0.4], title: "M-Key Connector", text: "These gold fingers slide into the M.2 slot on the motherboard. The notch tells it which way round to go." },
    ],
    // chip layout from teardowns of the 1 TB drive (single-sided): controller by the connector, then cache, then flash
    flows: {
      nodes: {
        keyP:  { at: [0.49, 0.22], label: "3.3 V pins", simple: "Power in", note: "M.2 connector" },
        keyD:  { at: [0.49, -0.12], label: "M-key", simple: "Gold fingers", note: "PCIe 4.0 x4 · NVMe" },
        pmic:  { at: [0.37, -0.28], label: "Regulators", simple: "Power parts" },
        ctrl:  { at: [0.25, 0.0], label: "Elpis controller", simple: "Controller", note: { data: "8 channels" } },
        dram:  { at: [0.04, 0.0], label: "LPDDR4", simple: "Cache", note: "1 GB · 1,866 MT/s" },
        nand1: { at: [-0.17, 0.0], label: "V-NAND", simple: "Flash chips", note: "2 × 4 Tbit · TLC" },
        nand2: { at: [-0.37, 0.0] },
      },
      power: [["keyP", "pmic", 3, { label: "3.3 V" }], ["pmic", "ctrl", 2], ["pmic", "dram", 1], ["pmic", "nand1", 1], ["pmic", "nand2", 1]],
      data: [
        ["keyD", "ctrl", 4, { kind: "pairs", both: true, label: "PCIe 4.0 x4" }],
        ["ctrl", "dram", 4, { kind: "ddr", both: true, label: "mapping table" }],
        ["ctrl", "nand1", 4, { kind: "ddr", both: true, label: "8 channels · 1,400 MT/s" }], ["ctrl", "nand2", 4, { kind: "ddr", both: true }],
      ],
    },
  },
  {
    id: "cooler", ghost: "FAN", icon: "ic-cooler.svg",
    title: ["CPU", "COOLER"], model: "Cooler Master Compact Tower",
    glb: "cooler.glb", size: 2.9, basis: ["-x", "y", "-z"], tilt: [-0.22, -0.75],
    spin: ["Object_2"], dense: /^Object_[24]$/,
    explode: {
      auto: true,
      labels: { Object_2: "Fan", Object_6: "Fan frame", Object_3: "Heat pipes", Object_4: "Fin stack", Object_5: "Copper base" },
      dirs: { Object_2: [0, 0, 0.36], Object_6: [0, 0, 0.22], Object_4: [0, 0.12, 0], Object_3: [0, 0, -0.1], Object_5: [0, -0.24, 0] },
    },
    modes: {
      overview:  "Nearly every watt a CPU uses becomes heat. The cooler carries it off through a heatsink, fans or a liquid loop to keep the chip safe.",
      framework: "A copper base sits on the CPU; heat pipes carry the heat up into a tower of thin aluminium fins with a fan strapped to the front.",
      power:     "The fan's 4-pin cable plugs into the CPU_FAN header on the motherboard: pin 1 is ground and pin 2 carries +12 V for the motor. The cooler itself needs no power — heat pipes move heat on their own.",
      data:      "Pin 4 carries a 25 kHz PWM signal from the motherboard that sets the fan's speed; pin 3 sends a tach signal back, two pulses per turn, so the board knows how fast it's spinning and can react as the CPU warms up.",
      airflow:   "The fan pushes cool air through the fins, picking up heat on the way and blowing it toward the back of the case.",
    },
    hotspots: [
      { id: "fan",   node: "Object_2", n: [0, 0, 1], title: "Fan", text: "A 4-pin PWM fan: the motherboard sets its speed, and the fan reports back how fast it's really spinning." },
      { id: "fins",  at: [-0.47, 0.25, -0.1], title: "Fin Stack", text: "Dozens of thin aluminium fins give the heat lots of surface area to escape from." },
      { id: "pipes", at: [0.5, 0.5, -0.05], n: [0.3, 1, 0.3], title: "Heat Pipes", text: "Sealed copper tubes with a little liquid inside that boils and condenses, moving heat fast." },
      { id: "base",  node: "Object_5", n: [0, -1, 0.4], title: "Copper Base", text: "A flat copper block that presses on the CPU and soaks up its heat." },
    ],
    // the 4-wire fan pinout from Intel's PWM fan specification; the header itself is on the motherboard, off the model
    flows: {
      inside: true, normal: [0, 1, 0],   // the motherboard is below the copper base
      nodes: {
        header: { at: [0.42, -0.5, 0.3], label: "CPU_FAN header", simple: "Fan plug", note: { power: "pin 1 GND · pin 2 +12 V", data: "pin 3 tach · pin 4 PWM" } },
        motor:  { node: "Object_2", label: "Fan motor", simple: "Fan", note: { data: "2 pulses per turn" } },
      },
      power: [["header", "motor", 0, { kind: "cable", harness: "fan4", plug: "from", axis: "x", via: FAN_ROUTE, label: "+12 V" }]],
      data:  [["header", "motor", 0, { kind: "cable", harness: "fan4", plug: "from", axis: "x", via: FAN_ROUTE, label: "PWM in · tach out" }]],
    },
    airflow: { dir: [0, 0, -1], spread: [0.8, 0.8], spin: 3 },
  },
  {
    id: "psu", ghost: "PSU", icon: "ic-psu.svg",
    title: ["POWER", "SUPPLY UNIT"], model: "ATX Power Supply",
    glb: "psu.glb", size: 3.1, basis: ["x", "y", "z"], tilt: [0.35, -0.6],
    spin: ["fan_5"],
    explode: {
      auto: true,
      labels: { frame_0: "Steel case", power_port_3: "Wall socket", power_switch_4: "Switch", fan_5: "Fan", vent_cover_6: "Exhaust vent", modular_ports_7: "Modular ports" },
      dirs: { frame_0: [0, 0, 0], fan_5: [0, 0.3, 0], vent_cover_6: [0, 0, 0.22], power_port_3: [0.05, 0.05, 0.34], Cylinder_8: [0.05, 0.05, 0.4], power_switch_4: [0, 0.1, 0.34], modular_ports_7: [0, 0, -0.3] },
    },
    modes: {
      overview:  "Every watt in the computer comes in here. The Power Supply Unit turns wall power into the steady voltages each part needs.",
      framework: "Behind the wall socket: an EMI filter, a bridge rectifier and an active PFC stage that charges a big bulk capacitor, then a high-frequency LLC converter and transformer, synchronous rectifiers for 12 V, and small DC-DC converters for 5 V and 3.3 V.",
      power:     "Wall AC is filtered, rectified and boosted to about 380–400 V DC, switched at high frequency through a transformer that isolates everything after it from the mains, rectified to 12 V, then stepped down again for 5 V and 3.3 V. A separate standby converter keeps 5 V alive whenever it's plugged in.",
      data:      "Two wires on the 24-pin plug do the talking: the motherboard pulls PS_ON# low to switch the main converter on, and a supervisor chip raises PWR_OK once every rail is steady. It also cuts the power if a rail goes out of range.",
      airflow:   "The big fan, facing down once installed, pulls air up from under the case, across the hot components, and out the back grille.",
    },
    hotspots: [
      { id: "fan",    node: "fan_5", n: [0, 1, 0], title: "Intake Fan", text: "A large, slow fan that keeps the power supply quiet and cool." },
      { id: "socket", node: "power_port_3", n: [0, 0, 1], title: "Wall Socket & Switch", text: "Where the power cable from the wall plugs in, next to the on/off switch." },
      { id: "cables", node: "modular_ports_7", n: [0, 0, -1], title: "Modular Ports", text: "The 24-pin motherboard, 8-pin CPU (EPS), PCIe and SATA cables plug in here — only the ones you need." },
    ],
    // the stages of a typical ATX supply in the order power passes through them (the model is a closed box: placement is schematic)
    flows: {
      inside: true, normal: [0, 1, 0],
      boards: [{ at: [0, -0.18, 0.06], size: [0.84, 0.74] }],
      nodes: {
        inlet: { node: "power_port_3", label: "AC inlet", simple: "Wall power in", note: "100–240 V AC" },
        emi:   { at: [0.3, -0.18, 0.22], label: "EMI filter", simple: "Filter" },
        pfc:   { at: [0.02, -0.18, 0.22], label: "Rectifier + PFC", simple: "AC → DC", note: { power: "≈ 380–400 V DC" } },
        bulk:  { at: [-0.3, -0.18, 0.22], label: "Bulk capacitor", simple: "Energy tank" },
        llc:   { at: [-0.3, -0.18, -0.08], label: "LLC + transformer", simple: "Transformer", note: { power: "isolates the mains", data: "switched on by PS_ON#" } },
        sr:    { at: [0.0, -0.18, -0.08], label: "Sync rectifier", simple: "12 V maker", note: { power: "12 V" } },
        dcdc:  { at: [0.3, -0.18, -0.08], label: "DC-DC", simple: "5 V + 3.3 V", note: "5 V · 3.3 V" },
        sb:    { at: [-0.3, -0.18, -0.3], label: "Standby", note: "5VSB · always on" },
        sup:   { at: [0.2, -0.18, -0.3], label: "Supervisor IC", simple: "Watchdog chip", note: "checks every rail" },
        ports: { node: "modular_ports_7", label: "Modular ports", simple: "Cables out", note: { power: "24-pin · EPS · PCIe · SATA", data: "24-pin: pin 16 PS_ON# · pin 8 PWR_OK" } },
      },
      power: [
        ["inlet", "emi", 0, { kind: "cable", harness: "acin", via: [[0.36, 0.0, 0.3]], label: "mains" }],
        // the transformer is the isolation gap: power crosses it magnetically, no copper joins the two sides
        ["emi", "pfc", 3], ["pfc", "bulk", 3], ["bulk", "llc", 3], ["llc", "sr", 3, { kind: "field", label: "transformer · no copper crosses" }],
        ["sr", "ports", 3, { label: "12 V" }], ["sr", "dcdc", 2], ["dcdc", "ports", 2, { label: "5 V · 3.3 V" }],
        ["bulk", "sb", 1], ["sb", "ports", 1, { label: "5VSB" }],
      ],
      data: [
        ["ports", "sup", 2, { both: true, label: "PS_ON# in · PWR_OK out" }],
        ["sup", "llc", 2, { kind: "field", label: "opto-coupler · on / off" }], ["dcdc", "sup", 2, { label: "rail sensing" }], ["sr", "sup", 2],
      ],
    },
    airflow: { dir: [0, -1, 0], spread: [0.8, 0.8], spin: 2.2, from: "top" },
  },
  {
    id: "case", ghost: "CASE", icon: "ic-case.svg",
    title: ["PC", "CASE"], model: "Corsair 4000D Airflow",
    glb: "case.glb", size: 2.9, basis: ["-z", "y", "x"], tilt: [-0.08, -0.6],
    spin: ["spin", "spin001", "spin002", "spin003"],
    explode: {
      auto: true,
      labels: { glass: "Glass side panel", front: "Front panel", top: "Top panel", back: "Rear panel", case: "Steel frame", inside: "Motherboard tray", buttons: "Power button", fan_base: "Front fans", fan_base003: "Rear fan" },
      dirs: {
        glass: [0, 0, 0.26], front: [0.22, 0, 0], top: [0, 0.16, 0], back: [-0.16, 0, 0], case: [0, 0, -0.05], inside: [0, 0, -0.12],
        buttons: [0.04, 0.24, 0], fan_base: [0.12, 0, 0.02], fan_base001: [0.12, 0, 0.02], fan_base002: [0.12, 0, 0.02], fan_base003: [-0.09, 0, 0.02],
      },
    },
    modes: {
      overview:  "The case holds every component in place, shields them from dust and bumps, and channels cool air across the hottest parts.",
      framework: "A steel frame with a motherboard tray, a shroud that hides the power supply, and removable glass and mesh panels.",
      power:     "No power runs through the case itself. The PSU sits under the shroud, and its cables go behind the motherboard tray and through the grommets to the 24-pin plug, the 8-pin CPU plug and the graphics card.",
      data:      "The power button is just a switch wired to the motherboard's front-panel header; the board then tells the PSU to start through the 24-pin plug. The front USB-C, USB 3.0 and audio jacks have their own cables to headers on the board.",
      airflow:   "Room for three 120 mm fans behind the front mesh and one at the back; one of each comes in the box. Cool air comes in the front, hot air goes out the back.",
    },
    hotspots: [
      { id: "glass",   node: "glass", n: [0, 0, 1], title: "Glass Side Panel", text: "Tempered glass lets you see the parts inside — and comes off with two thumbscrews." },
      { id: "intake",  node: "fan_base001", n: [1, 0, 0.25], title: "Intake Fans", text: "Room for three 120 mm fans behind the mesh front panel; one comes pre-installed, with another at the back." },
      { id: "exhaust", node: "fan_base003", n: [-1, 0, 0.25], title: "Exhaust Fan", text: "Pushes warm air out of the back so heat never builds up inside." },
      { id: "buttons", node: "buttons", n: [0, 1, 0.3], title: "Front I/O", text: "Power and reset buttons, USB-C, USB 3.0 and a headset jack, each wired to its own header on the motherboard." },
      { id: "shroud",  at: [-0.2, -0.36, 0.5], title: "PSU Shroud", text: "A cover that hides the power supply and its spare cables, keeping the build tidy." },
    ],
    // where an ATX board's plugs and headers land once it's on the tray (305 × 244 mm board, rear I/O at the back)
    flows: {
      plane: -0.3,   // the motherboard's depth, in front of the tray
      nodes: {
        psu:    { at: [-0.2, -0.4], label: "Power supply", simple: "Power supply", note: { power: "under the shroud", data: "starts when told" } },
        atx24:  { at: [0.1, 0.19], label: "24-pin", simple: "Main power plug", note: { power: "motherboard", data: "pin 16 PS_ON#" } },
        eps:    { at: [-0.28, 0.37], label: "8-pin EPS", simple: "CPU power", note: "CPU" },
        gpu:    { at: [-0.05, -0.02], label: "PCIe power", simple: "Graphics power", note: "2 × 8-pin → 12-pin adapter" }, gpu2: { at: [-0.02, -0.02] },
        btn:    { node: "buttons", off: [-0.03, 0, 0], label: "Power button", simple: "On button" },
        fio:    { node: "buttons", off: [0.04, 0, 0], label: "Front I/O", simple: "Front ports", note: "USB-C · USB 3.0 · audio" },
        fpanel: { at: [0.04, -0.24], label: "Front-panel header", simple: "Button wires", note: "PWR_SW" },
        usbh:   { at: [0.1, 0.0], label: "USB 3.0 header", note: "19-pin" }, usbch: { at: [0.1, 0.07], label: "USB-C header", note: "U31G2_E3" },
        audh:   { at: [-0.39, -0.24], label: "HD Audio header" },
      },
      power: [
        ["psu", "atx24", 0, { kind: "cable", harness: "atx24", plug: "to", axis: "y", via: ROUTE_24, label: "24-pin" }],
        ["psu", "eps", 0, { kind: "cable", harness: "eps8", plug: "to", axis: "x", via: [[-0.2, -0.3, -0.46], [-0.43, -0.18, -0.46], [-0.43, 0.46, -0.46], [-0.33, 0.47, -0.36]], label: "8-pin" }],
        ["psu", "gpu", 0, { kind: "cable", harness: "pcie8", plug: "to", axis: "x", via: [[-0.08, -0.33, -0.24]], label: "PCIe 8-pin × 2" }],
        ["psu", "gpu2", 0, { kind: "cable", harness: "pcie8", plug: "to", axis: "x", via: [[-0.05, -0.33, -0.22]] }],
      ],
      data: [
        ["btn", "fpanel", 0, { kind: "cable", harness: "pwrsw", plug: "to", via: [[0.36, 0.42, -0.46], [0.3, -0.31, -0.46], [0.08, -0.3, -0.36]], label: "switch" }],
        ["btn", "fpanel", 0, { kind: "cable", harness: "rstsw", plug: "to", via: [[0.37, 0.42, -0.45], [0.31, -0.32, -0.45], [0.09, -0.31, -0.35]] }],
        ["psu", "atx24", 0, { kind: "cable", harness: "atx24", plug: "to", axis: "y", via: ROUTE_24, label: "PS_ON# · PWR_OK" }],
        ["fio", "usbh", 0, { kind: "cable", harness: "usb3", plug: "to", via: [[0.36, 0.42, -0.46], [0.22, 0.02, -0.46], [0.17, 0.0, -0.36]], label: "USB 3.0" }],
        ["fio", "usbch", 0, { kind: "cable", harness: "usbc", plug: "to", via: [[0.35, 0.42, -0.44], [0.21, 0.08, -0.44], [0.17, 0.07, -0.35]], label: "USB-C" }],
        ["fio", "audh", 0, { kind: "cable", harness: "hda", plug: "to", via: [[0.36, 0.42, -0.46], [0.3, -0.33, -0.46], [-0.36, -0.33, -0.46], [-0.38, -0.3, -0.36]], label: "HD Audio" }],
      ],
    },
    airflow: { dir: [-1, 0, 0], spread: [0.75, 0.55], spin: 2 },
  },
];

// the story order ("Follow the Power"): energy (PSU, board), information (CPU, RAM, SSD, GPU), heat (cooler, case)
const STORY = ["psu", "mthr", "cpu", "ram", "storage", "gpu", "cooler", "case"];
PARTS.sort((a, b) => STORY.indexOf(a.id) - STORY.indexOf(b.id));

export const WEB = [  // the connection web from the Figma comps, as real links
  ["mthr", "gpu", "data"], ["mthr", "cpu", "data"], ["mthr", "ram", "data"], ["mthr", "storage", "data"],
  ["psu", "mthr", "power"], ["psu", "gpu", "power"], ["psu", "cpu", "power"],
  ["cooler", "cpu", "airflow"], ["gpu", "cooler", "airflow"],
  ["case", "gpu", "airflow"], ["case", "cooler", "airflow"], ["case", "mthr", "data"],
];

/* Plain-language layer (the default). Written for roughly 8–12 year olds; the detailed copy above is one tap away. */
export const SIMPLE = {
  mthr: {
    modes: {
      overview:  "The motherboard is like a busy city. Every other part plugs into it so they can all talk to each other.",
      framework: "It's a flat board made of thin layers, with copper roads hidden inside like pipes in a wall.",
      power:     "Electricity arrives from the power supply, and little power stations turn it down just right for each part.",
      data:      "Messages zoom along tiny copper roads between the brain (CPU), the memory and the graphics card.",
    },
    hotspots: {
      socket: "This is where the CPU — the computer's brain — sits.",
      ram:    "Memory sticks click in here, right next to the brain so it can grab things fast.",
      m2:     "A tiny storage stick lies flat here. No cables needed!",
      cmos:   "A watch battery! It remembers the time even when the computer is unplugged.",
      io:     "The plugs on the back of a computer: USB, sound and internet.",
    },
  },
  gpu: {
    modes: {
      overview:  "The graphics card draws every picture you see on the screen — up to hundreds of times every second.",
      framework: "Inside, a big metal radiator and copper pipes soak up heat from the chip that draws the pictures.",
      power:     "It's hungry! When you play games it can use as much power as five old-style light bulbs.",
      data:      "Thousands of tiny workers inside split up each picture and all draw their piece at the same time.",
      airflow:   "Two fans pull cool air through the metal fins and push the hot air out — like blowing on hot soup.",
    },
    hotspots: {
      ports: "Plug your screens in here.",
      power: "The cable from the power supply plugs in here.",
      fan:   "Fans spin to blow the heat away so the chip doesn't overheat.",
      core:  "The chip that does all the drawing hides under this copper plate.",
    },
  },
  cpu: {
    modes: {
      overview:  "The CPU is the computer's brain. It follows instructions — billions of them every second.",
      framework: "Under the metal lid are tiny chips of silicon, each smaller than your fingernail.",
      power:     "Power flows in through hundreds of the tiny pins at about one volt — less than an AA battery!",
      data:      "Instructions zip in through the pins, the brain's cores work on them, and answers zip out.",
    },
    hotspots: {
      tab:  "The little triangle shows which way round it goes — like a jigsaw piece.",
      ihs:  "A metal lid that protects the brain and helps it stay cool.",
      pins: "Over a thousand tiny gold pins! Bend one and the CPU might not work.",
    },
  },
  ram: {
    modes: {
      overview:  "RAM is short-term memory — like a desk where you keep the things you're working on right now.",
      framework: "A row of black memory chips sits on a small green board.",
      power:     "It needs power to remember. Switch the computer off and the desk is wiped clean!",
      data:      "Information rushes to and from the brain through the gold strip.",
    },
    hotspots: {
      chips:   "Each chip holds billions of 1s and 0s.",
      fingers: "Gold stripes connect the memory to the motherboard. Gold never rusts!",
      notch:   "This gap makes sure it only fits in one way.",
    },
  },
  storage: {
    modes: {
      overview:  "Storage is long-term memory. Your games, photos and files live here, even when the computer is off.",
      framework: "A little board with a controller chip (the librarian) and flash chips (the shelves).",
      power:     "It only needs a sip of power — and keeps your files safe with none at all.",
      data:      "The librarian fetches your files from the shelves and puts them on the brain's desk.",
    },
    hotspots: {
      ctrl: "The librarian: it knows where every file is kept.",
      nand: "The shelves: these chips hold everything you save.",
      key:  "This end slides into the motherboard.",
    },
  },
  cooler: {
    modes: {
      overview:  "The cooler stops the CPU from overheating, like a fan on a hot day.",
      framework: "Copper pipes carry heat up into lots of thin metal fins, and a fan blows it away.",
      power:     "The fan sips power from the motherboard. The pipes need none!",
      data:      "When the brain works hard and gets hot, the motherboard tells the fan to spin faster.",
      airflow:   "The fan pushes air through the fins, and the air carries the heat to the back.",
    },
    hotspots: {
      fan:   "It spins faster when the brain gets hot!",
      fins:  "Lots of thin fins give the heat plenty of places to escape.",
      pipes: "These copper pipes move heat super fast — faster than solid copper can.",
      base:  "This copper block sits right on the CPU and drinks up its heat.",
    },
  },
  psu: {
    modes: {
      overview:  "Everything starts here! The power supply turns wall electricity into the gentle kind computer parts can use.",
      framework: "Inside the metal box, coils and capacitors tame the wall power.",
      power:     "Strong wall power goes in; safe, low power comes out through all those cables.",
      data:      "The motherboard says \"wake up!\", and the power supply answers \"ready!\" once its power is steady.",
      airflow:   "The big fan pulls in cool air and pushes warm air out of the back.",
    },
    hotspots: {
      fan:    "A big, slow fan keeps it cool and quiet.",
      socket: "The wall cable plugs in here, next to the on/off switch.",
      cables: "Plug in just the cables you need, and they carry power to the other parts.",
    },
  },
  case: {
    modes: {
      overview:  "The case is the computer's house. It keeps every part safe and in the right place.",
      framework: "A strong metal frame with a big window, so you can see inside.",
      power:     "Power cables hide behind the tray and pop out where needed.",
      data:      "Press the on button and a wire tells the motherboard: wake up!",
      airflow:   "Fans at the front breathe cool air in; a fan at the back blows hot air out.",
    },
    hotspots: {
      glass:   "A window, so you can see all the parts inside!",
      intake:  "Fans pull cool air in — like breathing in.",
      exhaust: "This fan blows the hot air out — like breathing out.",
      buttons: "The on button! Plus places to plug in a mouse or headphones.",
      shroud:  "A cupboard at the bottom where the power supply hides.",
    },
  },
};

/* Real-world size, as a comparison (simple) or as numbers (detailed). */
export const SIZE = {
  mthr:    { simple: "About as big as a sheet of paper", detailed: "ATX: 305 × 244 mm" },
  gpu:     { simple: "About as long as a school ruler", detailed: "285 × 112 mm, two slots thick" },
  cpu:     { simple: "About the size of a cracker", detailed: "40 × 40 mm AM4 package" },
  ram:     { simple: "About as long as a TV remote", detailed: "133 × 31 mm DIMM" },
  storage: { simple: "About the size of a stick of gum", detailed: "M.2 2280: 22 × 80 mm" },
  cooler:  { simple: "A bit taller than a soda can", detailed: "≈ 155 mm tall tower" },
  psu:     { simple: "About as big as a lunchbox", detailed: "ATX: 150 × 86 × 140 mm" },
  case:    { simple: "About as big as a small suitcase", detailed: "Mid-tower: 466 × 230 × 453 mm" },
};

/* Build-a-PC workshop: where each part goes, what to say while it's being dragged, and what to say once it's in. */
export const BUILD_TEXT = {
  mthr:    { slot: "Motherboard tray", where: "into the case", ask: "Drag the motherboard into the case — everything else plugs into it.",
             done: "The motherboard is screwed onto the tray. Now it needs a brain." },
  cpu:     { slot: "CPU socket", where: "into the socket", ask: "Every computer needs a brain. Drag the CPU into the square socket.",
             done: "The CPU drops into the socket — the little triangle lines it up." },
  cooler:  { slot: "On the CPU", where: "onto the CPU", ask: "The brain gets hot when it thinks. Drag the cooler on top of it.",
             done: "The cooler's copper base presses on the CPU and pulls the heat away." },
  ram:     { slot: "Memory slots", where: "into the memory slots", ask: "Drag the memory into the long slots beside the CPU.",
             done: "Click! Two sticks go in slots 2 and 4 so they can work as a team." },
  storage: { slot: "M.2 slot", where: "onto the M.2 slot", ask: "Your games need a home. Drag the SSD onto the small slot on the board.",
             done: "The SSD lies flat in its slot. Your files have a home." },
  gpu:     { slot: "PCIe slot", where: "into the long PCIe slot", ask: "Time for pictures! Drag the graphics card into the long slot below the CPU.",
             done: "The graphics card clicks into the PCIe slot, its ports poking out of the back." },
  psu:     { slot: "Power supply bay", where: "into the bottom of the case", ask: "Nothing works without power. Drag the power supply into the bottom of the case.",
             done: "The power supply slides under the shroud, fan facing down to breathe." },
};

/* What each exploded layer does (tap a label in "Take it apart"). */
export const LAYERS = {
  "Shroud": "The outer shell that guides air through the card and protects the insides.",
  "Cover plate": "A metal plate over the fans that also makes the card stiff.",
  "Heatsink fins": "Hundreds of thin fins give the heat lots of places to escape.",
  "Circuit board": "The board everything is soldered to — copper roads carry power and data between the chips.",
  "Backplate": "A metal back that protects the board and keeps it from bending.",
  "Display ports": "Where your screens plug in.",
  "Heat pipes": "Copper pipes that carry heat away from the chip super fast.",
  "Cold plate": "Copper that touches the chip and soaks up its heat.",
  "12-pin power": "Where the power cable from the power supply plugs in.",
  "Fans": "They spin to push air through the fins.",
  "Fan": "It spins to push air through the fins.",
  "Fan frame": "Holds the fan in place and points its air the right way.",
  "Memory sticks": "The computer's short-term memory, standing in their slots.",
  "Processor": "The CPU — the computer's brain — sitting in its socket.",
  "I/O cover": "A cover over the back ports, often with lights in it.",
  "Heatsink covers": "Metal covers that keep hot chips on the board cool.",
  "M.2 SSD": "Storage that lies flat on the board — no cables needed.",
  "CMOS battery": "A watch battery that remembers the time and your settings.",
  "Socket latch": "The lever and frame that clamp the CPU down.",
  "Memory chips": "Each chip holds billions of 1s and 0s.",
  "Gold contacts": "Gold stripes that connect the stick to the motherboard.",
  "Heat spreader": "A metal cover that spreads heat away from the chips.",
  "Light bar": "Just for looks — it glows!",
  "Controller": "The drive's little brain. It knows where every file is kept.",
  "Cache chip": "A bit of fast memory that helps the controller keep track of files.",
  "Flash chips": "Where your files are actually stored, even with the power off.",
  "Label sticker": "Tells you the model, and sometimes helps spread heat.",
  "Fin stack": "Thin metal fins give the heat lots of surface to escape from.",
  "Top cover": "A cap that tidies up the top of the fins.",
  "Copper base": "Sits right on the CPU and soaks up its heat.",
  "Steel case": "A strong metal box that keeps the high-voltage parts safely inside.",
  "Fan grille": "Stops fingers and cables from touching the fan.",
  "Exhaust vent": "Hot air escapes through these holes.",
  "Wall socket": "The power cable from the wall plugs in here.",
  "Switch": "Turns the power supply on or off.",
  "Output cables": "Bundles of wires that carry power to every other part.",
  "Cable plate": "Where the cables leave the box.",
  "Modular ports": "Sockets for the power cables, so you only plug in the ones you need.",
  "Glass side panel": "A window so you can see inside. It slides off for building.",
  "Front panel": "A mesh front that lets the fans breathe in lots of cool air.",
  "Top panel": "Covers the top, with room for more fans underneath.",
  "Rear panel": "Where the motherboard's ports, the graphics card and the power cable poke out.",
  "Steel frame": "The skeleton of the case that everything screws onto.",
  "Motherboard tray": "The wall the motherboard is screwed to. Cables hide behind it.",
  "Power button": "Turns the computer on. It's wired to the motherboard.",
  "Front fans": "Room for three fans that pull cool air in; one comes in the box.",
  "Vapour chamber": "A flat, sealed copper chamber that spreads the chip's heat fast.",
  "Rear fan": "Blows the warm air out of the back.",
};

/* Quick Reference glossary (the Figma sitemap's last branch). `match` lists the words that get linked in the copy. */
export const GLOSSARY = [
  { term: "CPU", match: ["CPU", "processor"], parts: ["cpu"], simple: "The computer's brain. It follows the instructions in every app and game.", detailed: "Central Processing Unit: executes program instructions across several cores, each running billions of cycles per second." },
  { term: "GPU", match: ["GPU", "graphics card"], parts: ["gpu"], simple: "The part that draws everything you see on the screen.", detailed: "Graphics Processing Unit: thousands of small cores working in parallel, ideal for rendering, video and AI." },
  { term: "RAM", match: ["RAM", "memory sticks?", "DIMM"], parts: ["ram"], simple: "Short-term memory — like a desk for the things you're working on right now.", detailed: "Random Access Memory: fast, volatile storage the CPU reads and writes constantly; cleared when power is off." },
  { term: "SSD", match: ["SSD", "solid-state drives?"], parts: ["storage"], simple: "Long-term memory that keeps your files even when the computer is off.", detailed: "Solid-State Drive: stores data in NAND flash with no moving parts; NVMe models talk to the CPU over PCIe." },
  { term: "Motherboard", match: ["motherboard"], parts: ["mthr"], simple: "The big board everything plugs into so the parts can talk to each other.", detailed: "The main circuit board: sockets, slots, power delivery and copper traces that connect every component." },
  { term: "PSU", match: ["power supply", "PSU"], parts: ["psu"], simple: "Changes electricity from the wall into the gentle kind computer parts can use.", detailed: "Power Supply Unit: converts AC mains power to regulated 12 V, 5 V and 3.3 V DC rails." },
  { term: "Cooler", match: ["cooler"], parts: ["cooler"], simple: "Keeps the CPU from overheating, like a fan on a hot day.", detailed: "Moves heat from the CPU into fins (air cooler) or a radiator (liquid cooler) where fans carry it away." },
  { term: "PCIe", match: ["PCIe"], parts: ["mthr", "gpu", "storage"], simple: "A super-fast connection used by graphics cards and fast SSDs.", detailed: "PCI Express: a point-to-point serial bus made of lanes; a graphics card usually uses 16 of them." },
  { term: "M.2", match: ["M\\.2"], parts: ["mthr", "storage"], simple: "A small slot where a stick-shaped SSD lies flat on the motherboard.", detailed: "A compact connector and form factor; M-key M.2 slots carry PCIe lanes for NVMe SSDs." },
  { term: "NVMe", match: ["NVMe"], parts: ["storage"], simple: "The fast language a modern SSD uses to talk to the computer.", detailed: "Non-Volatile Memory Express: a storage protocol designed for flash over PCIe, with very low latency." },
  { term: "Socket", match: ["socket"], parts: ["mthr", "cpu"], simple: "The square holder on the motherboard where the CPU sits.", detailed: "The CPU mount with contacts and a retention latch: pins in the socket (LGA1151, AM5) or on the CPU (AM4)." },
  { term: "DMI", match: ["DMI"], parts: ["mthr"], simple: "The road between the CPU and the chipset.", detailed: "Direct Media Interface: Intel's CPU-to-chipset link. DMI 3.0 is about as fast as four PCIe 3.0 lanes (≈3.9 GB/s), shared by everything on the chipset." },
  { term: "Infinity Fabric", match: ["Infinity Fabric"], parts: ["cpu"], simple: "The roads that join the chips inside an AMD processor.", detailed: "AMD's interconnect between chiplets: it links each compute die to the I/O die." },
  { term: "Chiplet", match: ["chiplets?"], parts: ["cpu"], simple: "A small chip that teams up with others under one lid.", detailed: "One of several dies in a single package, e.g. compute dies plus an I/O die, made on whichever process suits each job." },
  { term: "PWM", match: ["PWM"], parts: ["cooler"], simple: "A fast on-off signal that tells a fan how fast to spin.", detailed: "Pulse-width modulation: a 25 kHz signal on pin 4 of a fan header whose duty cycle sets the speed." },
  { term: "PFC", match: ["PFC"], parts: ["psu"], simple: "A part of the power supply that sips wall power smoothly.", detailed: "Power factor correction: a boost stage that draws current in step with the mains voltage and charges the bulk capacitor to about 380–400 V DC." },
  { term: "Chipset", match: ["chipset"], parts: ["mthr"], simple: "A helper chip on the motherboard that directs traffic for USB, drives and more.", detailed: "Platform controller that hangs extra I/O (USB, SATA, extra PCIe) off the CPU's link." },
  { term: "Voltage regulators", match: ["voltage regulators?", "VRM"], parts: ["mthr"], simple: "Little power stations next to the CPU that turn 12 volts into exactly what it needs.", detailed: "Voltage Regulator Modules: multiphase buck converters that step 12 V down to about 1 V at high current." },
  { term: "Heatsink", match: ["heatsinks?", "heat sinks?"], parts: ["gpu", "cooler", "mthr"], simple: "Metal with lots of fins that soaks up heat and lets air carry it away.", detailed: "A passive thermal mass with high surface area, usually aluminium fins on a copper base." },
  { term: "Heat pipe", match: ["heat pipes?"], parts: ["gpu", "cooler"], simple: "A sealed copper pipe that moves heat really fast.", detailed: "A sealed tube where a working fluid evaporates at the hot end and condenses at the cold end." },
  { term: "Fins", match: ["fins", "fin stack"], parts: ["gpu", "cooler"], simple: "Thin metal plates that give heat lots of places to escape.", detailed: "Stacked aluminium plates that maximise surface area for convective cooling." },
  { term: "Vapor chamber", match: ["vapou?r chamber"], parts: ["gpu"], simple: "A flat, sealed copper plate that spreads heat out quickly.", detailed: "A planar heat pipe that spreads heat from a hot die across a large area." },
  { term: "Silicon", match: ["silicon", "die"], parts: ["cpu", "gpu"], simple: "The material computer chips are made from — the same stuff as sand.", detailed: "The semiconductor wafer the transistors are etched into; a cut piece is called a die." },
  { term: "Core", match: ["cores?"], parts: ["cpu", "gpu"], simple: "One worker inside a chip. More cores means more jobs at once.", detailed: "An independent execution unit; CPUs have a few powerful cores, GPUs thousands of simple ones." },
  { term: "Cache", match: ["cache"], parts: ["cpu", "storage"], simple: "A tiny, super-fast memory kept right next to where the work happens.", detailed: "Small SRAM (or DRAM on SSDs) that holds recently used data to avoid slower trips." },
  { term: "DisplayPort", match: ["DisplayPort", "display ports?"], parts: ["gpu"], simple: "A plug for connecting screens to the graphics card.", detailed: "A digital display interface supporting high resolutions and refresh rates; HDMI is its TV-world cousin." },
  { term: "HDMI", match: ["HDMI"], parts: ["gpu"], simple: "The plug that connects to TVs and many monitors.", detailed: "High-Definition Multimedia Interface: digital video and audio over one cable." },
  { term: "CMOS battery", match: ["CMOS"], parts: ["mthr"], simple: "A watch battery that remembers the time and your settings.", detailed: "Powers the real-time clock and keeps firmware settings when the PC is unplugged." },
  { term: "I/O", match: ["I/O"], parts: ["mthr"], simple: "Input and output: the plugs where things go in and come out.", detailed: "Input/Output ports such as USB, audio and Ethernet on the rear panel." },
  { term: "Flash memory", match: ["flash", "NAND"], parts: ["storage"], simple: "Memory that keeps your files with no power at all.", detailed: "NAND flash stores charge in floating-gate or charge-trap cells; it survives power loss." },
  { term: "Controller", match: ["controller"], parts: ["storage"], simple: "A small chip that acts like a librarian for your files.", detailed: "The SSD's processor: maps logical blocks to flash pages, wear-levels and corrects errors." },
  { term: "DDR4", match: ["DDR4"], parts: ["ram"], simple: "A generation of RAM. Newer generations are faster.", detailed: "Fourth-generation Double Data Rate SDRAM; DDR5 is its successor." },
  { term: "ATX", match: ["ATX"], parts: ["mthr", "psu"], simple: "A standard size, so parts from different companies fit together.", detailed: "A form-factor standard defining board size (305 × 244 mm), mounting holes and PSU connectors." },
  { term: "Watt", match: ["watts?"], parts: ["psu", "gpu"], simple: "How much power something uses. A graphics card can use hundreds!", detailed: "Unit of power (joules per second); volts × amps." },
  { term: "Volt", match: ["volts?", "voltages?"], parts: ["psu", "mthr"], simple: "How hard electricity is pushed. Wall power pushes much harder than computer parts like.", detailed: "Unit of electric potential; PCs use 12 V, 5 V and 3.3 V rails, the CPU around 1 V." },
  { term: "Capacitor", match: ["capacitors?"], parts: ["psu", "mthr"], simple: "A tiny energy tank that smooths out bumps in the power.", detailed: "Stores charge to filter ripple and supply short bursts of current." },
  { term: "Case", match: ["case", "mid-tower"], parts: ["case"], simple: "The computer's house: a metal box that holds and protects every part.", detailed: "The chassis: a steel frame with panels, fan mounts and a motherboard tray, sized to a form factor such as ATX." },
  { term: "Shroud", match: ["shroud"], parts: ["case", "gpu"], simple: "A cover that hides messy parts and guides the air.", detailed: "A panel that conceals components (like the PSU) or ducts airflow (like a GPU's fan shroud)." },
  { term: "Bottleneck", match: ["bottleneck"], parts: ["cpu", "gpu"], simple: "When one slow part holds the fast parts back, like a narrow door at a busy party.", detailed: "The component that limits overall throughput; upgrading anything else won't raise performance." },
];

/* Size line-up (the Figma sitemap's "Compare Specs"): each part's longest side in millimetres. */
export const REAL_MM = { mthr: 305, gpu: 285, cpu: 40, ram: 133, storage: 80, cooler: 155, psu: 150, case: 466 };
