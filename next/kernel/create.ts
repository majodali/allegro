// Where a launcher finds the kernel: `createKernel`, of type
// `CreateKernel` (next/kernel/interface.ts). The acceptance stream's
// terminal entry, next/launch/terminal.ts, loads this file by path.
//
// It gives the reference kernel (next/kernel/kernel.ts). A configuration
// that chooses among kernel variants would choose here.

export { createKernel } from "./kernel.js";
