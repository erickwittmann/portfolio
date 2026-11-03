/* Build-a-PC workshop: the parts you can pick, what they cost, and how they change the finished computer.
   Prices are rounded example prices in US dollars, not live quotes. Each option reuses its category's 3D model,
   shown at that option's real size (`mm` is the longest side). */

export const CASE = { name: "Corsair 4000D Airflow", price: 105, gpuMax: 360, coolerMax: 170 };

export const CATEGORIES = [
  { id: "mthr", name: "Motherboard", needs: [], options: [
    { id: "a520", name: "A520 Basic",  price: 79,  m2: 3500, line: "PCIe 3.0 · 1 M.2 slot",
      simple: "A starter board. Its roads to the SSD are half as fast." },
    { id: "b550", name: "B550 Gaming", price: 129, m2: 7000, line: "PCIe 4.0 · 2 M.2 slots",
      simple: "Fast roads for the newest SSDs and graphics cards." },
    { id: "x570", name: "X570 Pro",    price: 199, m2: 7000, line: "PCIe 4.0 · 3 M.2 · Wi-Fi",
      simple: "Lots of extra slots, plus built-in Wi-Fi." },
  ] },
  { id: "cpu", name: "Processor (CPU)", needs: ["mthr"], options: [
    { id: "r5", name: "Ryzen 5 3600",    price: 85,  cores: 6,  watts: 90,  cap: 110, multi: 100, line: "6 cores · 4.2 GHz",
      simple: "6 brains in one chip. Great for most games." },
    { id: "r7", name: "Ryzen 7 5800X3D", price: 299, cores: 8,  watts: 120, cap: 200, multi: 150, line: "8 cores · big gaming cache",
      simple: "Extra-big memory right inside the chip makes games fly." },
    { id: "r9", name: "Ryzen 9 5950X",   price: 389, cores: 16, watts: 145, cap: 170, multi: 270, line: "16 cores · 4.9 GHz",
      simple: "16 brains! Best for making videos and doing lots at once." },
  ] },
  { id: "cooler", name: "CPU cooler", needs: ["cpu"], options: [
    { id: "mini",  name: "Mini tower",    price: 25, mm: 125, cools: 110, line: "92 mm fan · 12.5 cm tall",
      simple: "Small and cheap. Fine for a 6-core chip." },
    { id: "tower", name: "Compact tower", price: 39, mm: 155, cools: 160, line: "120 mm fan · 15.5 cm tall",
      simple: "A bigger fin stack moves more heat." },
    { id: "big",   name: "Big tower",     price: 79, mm: 165, cools: 220, line: "140 mm fan · 16.5 cm tall",
      simple: "Huge fins keep even 16 cores cool and quiet." },
  ] },
  { id: "ram", name: "Memory (RAM)", needs: ["mthr"], options: [
    { id: "16", name: "16 GB (2 × 8)",  price: 35,  gb: 16, sticks: 2, line: "DDR4-3200 · 2 sticks",
      simple: "Enough desk space for games and homework." },
    { id: "32", name: "32 GB (2 × 16)", price: 60,  gb: 32, sticks: 2, line: "DDR4-3600 · 2 sticks",
      simple: "Room for a game, a video call and 30 browser tabs." },
    { id: "64", name: "64 GB (4 × 16)", price: 120, gb: 64, sticks: 4, line: "DDR4-3600 · 4 sticks",
      simple: "A giant desk for video editing and 3D art." },
  ] },
  { id: "storage", name: "Storage (SSD)", needs: ["mthr"], options: [
    { id: "500", name: "500 GB Gen3", price: 35,  gb: 500,  speed: 3500, line: "NVMe · 3,500 MB/s",
      simple: "Room for about 5 big games." },
    { id: "1t",  name: "1 TB Gen4",   price: 60,  gb: 1000, speed: 7000, line: "NVMe · 7,000 MB/s",
      simple: "Room for about 10 big games, and twice as fast." },
    { id: "2t",  name: "2 TB Gen4",   price: 110, gb: 2000, speed: 7000, line: "NVMe · 7,000 MB/s",
      simple: "Room for about 20 big games." },
  ] },
  { id: "gpu", name: "Graphics card", needs: ["mthr"], options: [
    { id: "4060", name: "RTX 4060", price: 299,  mm: 240, watts: 115, fps: 75,  vram: 8,  line: "8 GB · 115 W · 24 cm",
      simple: "Smooth games at normal settings. Sips power." },
    { id: "3080", name: "RTX 3080", price: 549,  mm: 285, watts: 320, fps: 120, vram: 10, line: "10 GB · 320 W · 28.5 cm",
      simple: "Fast and beautiful games. Needs a strong power supply." },
    { id: "4090", name: "RTX 4090", price: 1599, mm: 336, watts: 450, fps: 210, vram: 24, line: "24 GB · 450 W · 33.6 cm",
      simple: "The biggest, fastest card — and very hungry for power." },
  ] },
  { id: "psu", name: "Power supply", needs: [], options: [
    { id: "550",  name: "550 W Bronze", price: 55,  mm: 150, watts: 550,  line: "80+ Bronze · 14 cm",
      simple: "Enough for a small build." },
    { id: "750",  name: "750 W Gold",   price: 90,  mm: 150, watts: 750,  line: "80+ Gold · 14 cm",
      simple: "Plenty for most gaming PCs." },
    { id: "1000", name: "1000 W Gold",  price: 160, mm: 165, watts: 1000, line: "80+ Gold · 16.5 cm",
      simple: "Power for the hungriest graphics cards." },
  ] },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// the order the hints suggest; anything whose `needs` are in can go in at any time
export const ORDER = ["mthr", "cpu", "cooler", "ram", "storage", "gpu", "psu"];

export const PRESETS = {
  budget:   { label: "Budget",   pick: { mthr: "a520", cpu: "r5", cooler: "mini",  ram: "16", storage: "500", gpu: "4060", psu: "550" } },
  balanced: { label: "Balanced", pick: { mthr: "b550", cpu: "r7", cooler: "tower", ram: "32", storage: "1t",  gpu: "3080", psu: "750" } },
  dream:    { label: "Dream",    pick: { mthr: "x570", cpu: "r9", cooler: "big",   ram: "64", storage: "2t",  gpu: "4090", psu: "1000" } },
};

export const option = (cat, sel) => CAT[cat].options.find((o) => o.id === sel[cat]) || CAT[cat].options[0];

/* What a build can do. `has` is the set of categories in the case; missing parts count as nothing. */
export function stats(sel, has) {
  const o = (c) => (has.has(c) ? option(c, sel) : null);
  const mb = o("mthr"), cpu = o("cpu"), cool = o("cooler"), ram = o("ram"), ssd = o("storage"), gpu = o("gpu"), psu = o("psu");
  const price = CASE.price + [...has].reduce((a, c) => a + option(c, sel).price, 0);
  // CPU heat against what the cooler can carry away; no cooler at all means it overheats straight away
  const temp = cpu ? Math.min(100, Math.round(30 + 55 * (cpu.watts / (cool ? cool.cools : 40)))) : 0;
  const throttle = temp >= 90 ? 0.82 : 1;
  const ramK = ram ? (ram.gb >= 32 ? 1 : 0.94) : 0;
  // games run as fast as the slower of the two chips allows (the bottleneck)
  const fps = cpu && gpu && ram ? Math.round(Math.min(gpu.fps, cpu.cap) * ramK * throttle) : 0;
  const multi = cpu && ram ? Math.round(cpu.multi * (ram.gb >= 64 ? 1.08 : ram.gb >= 32 ? 1 : 0.85) * throttle) : 0;
  // graphics cards spike about 10% above their rated power for a split second; the PSU has to ride that out
  const draw = Math.round((mb ? 45 : 0) + (cpu ? cpu.watts : 0) + (gpu ? gpu.watts * 1.1 : 0) + (ram ? ram.sticks * 4 : 0) + (ssd ? 6 : 0) + 15);   // + case fans
  const speed = ssd ? Math.min(ssd.speed, mb ? mb.m2 : ssd.speed) : 0;
  return {
    price, fps, multi, temp, draw, speed,
    ram: ram ? ram.gb : 0, storage: ssd ? ssd.gb : 0, psu: psu ? psu.watts : 0,
    bottleneck: cpu && gpu && gpu.fps > cpu.cap * 1.08 ? "cpu" : null,
  };
}

/* Problems worth telling the builder about, worst first. */
export function warnings(sel, has, s, simple) {
  const out = [];
  if (has.has("psu") && has.has("gpu") && s.draw > s.psu * 0.95) out.push({ level: "bad", cat: "psu", text: simple ? `The power supply is too small! This PC needs about ${s.draw} W.` : `PSU overloaded: ~${s.draw} W peak on a ${s.psu} W unit. It will shut off under load.` });
  else if (has.has("psu") && s.draw > s.psu * 0.8) out.push({ level: "warn", cat: "psu", text: simple ? "The power supply is nearly maxed out. A bigger one gives some breathing room." : `Tight on power: ${Math.round((s.draw / s.psu) * 100)}% of the PSU at peak. Aim for under 80%.` });
  if (has.has("cpu") && !has.has("cooler")) out.push({ level: "warn", cat: "cooler", text: simple ? "The CPU has no cooler yet — it would overheat in seconds." : "No CPU cooler: the processor would hit its thermal limit almost immediately." });
  else if (s.temp >= 90) out.push({ level: "warn", cat: "cooler", text: simple ? "The CPU runs too hot and slows itself down. Try a bigger cooler." : `CPU at ~${s.temp} °C under load — it will throttle. A bigger cooler fixes it.` });
  if (s.bottleneck) out.push({ level: "info", cat: "cpu", text: simple ? "The graphics card is waiting on the CPU. A faster CPU would unlock more speed." : "CPU bottleneck: the GPU could render more frames than this CPU can prepare." });
  if (has.has("storage") && has.has("mthr") && option("storage", sel).speed > option("mthr", sel).m2) out.push({ level: "info", cat: "mthr", text: simple ? "This SSD is faster than the board's roads, so it runs at half speed." : "Gen4 SSD on a PCIe 3.0 board: limited to ~3,500 MB/s." });
  return out;
}
