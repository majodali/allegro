// The file system of a terminal, as the bounded reader asks for it
// (B-196 (the rebuild's acceptance side), chunk Q16 (the capabilities the
// launchers ship), part 2). It is the one place the loader's reading
// touches fs: next/launch/files.ts holds the bound and is host-neutral.
//
// Used by the entries that start the bootstrap's driver: `npm run
// allegretto` (next/launch/allegretto.ts), `npm run emit`
// (next/bootstrap/emit.ts) and the corpus's runner
// (next/corpus/allegretto.ts). Tested with next/launch/files.test.ts.

import * as fs from "fs";
import * as path from "path";
import type { ReadText } from "../bootstrap/driver.js";
import { boundedReader, type FileHost } from "./files.js";

/** A terminal's file system. */
export const nodeFiles: FileHost = {
  realPath(file) {
    try {
      return fs.realpathSync(file);
    } catch {
      return undefined;
    }
  },
  isFile: (realFile) => fs.statSync(realFile).isFile(),
  read: (realFile) => fs.readFileSync(realFile, "utf8"),
  separator: path.sep,
};

/** The reader for a text read from `file`: bounded to the project's directory, which is the directory of the text. */
export function projectReader(file: string): ReadText {
  return boundedReader([path.dirname(path.resolve(file))], nodeFiles);
}
