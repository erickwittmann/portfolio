export const INSULATION = {
  orange: "#e0661a", red: "#c22a20", yellow: "#e2b30e", black: "#171717", gray: "#8d8d8d", purple: "#6a3aa6",
  green: "#1f8a3c", blue: "#1f4fb5", white: "#dcdcdc", brown: "#5b351b", greenyellow: "#94ad1e", jacket: "#1a1a1a",
};

const P = (sig, col) => [sig, col, "p", 1], G = (col = "black") => ["COM", col, "g", -1];
const D = (sig, col, dir = 1) => [sig, col, "d", dir];

export const HARNESS = {
  atx24: {
    name: "24-pin ATX", rows: 2, pitch: 4.2, od: 2.4, housing: 9.6, color: "#0e0e0f",
    pins: [
      P("+3.3V", "orange"), P("+3.3V", "orange"), G(), P("+5V", "red"), G(), P("+5V", "red"), G(), D("PWR_OK", "gray", 1), P("+5VSB", "purple"), P("+12V", "yellow"), P("+12V", "yellow"), P("+3.3V", "orange"),
      P("+3.3V", "orange"), P("−12V", "blue"), G(), D("PS_ON#", "green", -1), G(), G(), G(), null, P("+5V", "red"), P("+5V", "red"), P("+5V", "red"), G(),
    ],
    extras: [[12, ["3.3V SENSE", "brown", "-", 0], 0.6]],
  },
  eps8: { name: "8-pin EPS", rows: 2, pitch: 4.2, od: 2.4, housing: 9.6, color: "#0e0e0f", pins: [G(), G(), G(), G(), P("+12V", "yellow"), P("+12V", "yellow"), P("+12V", "yellow"), P("+12V", "yellow")] },
  nv12: { name: "12-pin", rows: 2, pitch: 3.0, od: 2.0, housing: 7.4, color: "#0e0e0f", pins: [P("+12V", "yellow"), P("+12V", "yellow"), P("+12V", "yellow"), P("+12V", "yellow"), P("+12V", "yellow"), P("+12V", "yellow"), G(), G(), G(), G(), G(), G()] },
  pcie8: { name: "PCIe 8-pin", rows: 2, pitch: 4.2, od: 2.4, housing: 9.6, color: "#0e0e0f", pins: [P("+12V", "yellow"), P("+12V", "yellow"), P("+12V", "yellow"), G(), G(), G(), G(), G()] },
  fan4: { name: "4-pin fan", rows: 1, pitch: 2.54, od: 1.25, housing: 6, color: "#f2f2f0", pins: [G(), P("+12V", "yellow"), D("TACH", "green", -1), D("PWM", "blue", 1)] },
  pwrsw: { name: "POWER SW", rows: 1, pitch: 2.54, od: 1.1, housing: 5, color: "#111", twist: 34, pins: [D("PWR_SW", "black", 1), D("GND", "black", 1)] },
  rstsw: { name: "RESET SW", rows: 1, pitch: 2.54, od: 1.1, housing: 5, color: "#111", twist: 30, pins: [["RESET", "black", "-", 0], ["GND", "black", "-", 0]] },
  usb3: { name: "USB 3.0", rows: 1, pitch: 1.0, od: 1.0, housing: 8, color: "#151515", pins: Array.from({ length: 9 }, () => D("USB", "black", 1)) },
  usbc: { name: "USB-C", rows: 1, pitch: 0, od: 4.0, housing: 6, color: "#151515", jacket: true, pins: [D("USB", "jacket", 1)] },
  hda:  { name: "HD Audio", rows: 1, pitch: 0, od: 3.6, housing: 5, color: "#111", jacket: true, pins: [D("AUDIO", "jacket", 1)] },
  acin: { name: "AC", rows: 1, pitch: 3.4, od: 3.0, pins: [P("L", "brown"), ["N", "blue", "g", -1], ["PE", "greenyellow", "-", 0]] },
};
