// The loader's file reading, bounded (B-196 (the rebuild's acceptance
// side), chunk Q16 (the capabilities the launchers ship), part 2,
// docs/plans/rebuild-acceptance.md §5).
//
// What it realises, from docs/plans/book-pass-inventory.md:
//   "The platform ships three phases: check, run and export": the loader
//    "reads files in the project's and the platform's directories and
//    nowhere else", so checking a project nobody trusts yet reads nothing
//    else
//   "The loader reaches files through a capability", as far as the bound
//    goes: whoever starts the loader hands it the reader, and the loader
//    acquires nothing
//
// What it is. A reader of texts that is given the directories it may read
// in, and reads a file only where the file's real path, with every link
// followed, is inside one of them. A file that is not there is absent. A
// file that is there and outside the directories is refused, with a reason
// that names it: a link inside a project that leads out of it is followed
// to where it leads and then refused. The directories' own real paths are
// taken once, when the reader is made, and a directory that is not there
// bounds nothing.
//
// What it is not yet. The loader is the bootstrap's driver
// (next/bootstrap/driver.ts), which is host code, so this reader is a host
// function it is handed and no capability a program can declare. When the
// module loader is written in Allegro it takes the same bound as a
// capability's part, and its name and shape are proposed then. The new
// tree has no platform directory yet: the directories given today are the
// project's alone.
//
// It is host-neutral: it reaches the file system only through the host it
// is handed (`FileHost`). The host over a terminal's file system is
// next/launch/node-files.ts. Tested by next/launch/files.test.ts.

import type { ReadRefused, ReadText } from "../bootstrap/driver.js";

/** What the reader asks of a file system. */
export interface FileHost {
  /** The real path of what `file` names, with every link followed. None: nothing is there. */
  realPath(file: string): string | undefined;
  /** Whether what is at a real path is a file. */
  isFile(realFile: string): boolean;
  /** The text of the file at a real path. */
  read(realFile: string): string;
  /** What separates the parts of a path on this host. */
  readonly separator: string;
}

/** Whether the real path `file` is inside the real path `directory`, at any depth. */
export function inside(file: string, directory: string, separator: string): boolean {
  const prefix = directory.endsWith(separator) ? directory : directory + separator;
  return file.startsWith(prefix);
}

/**
 * A reader bounded to `directories`: the text of a file whose real path is
 * inside one of them, undefined where there is no such file, and a refusal
 * where the file is there and outside them all.
 */
export function boundedReader(directories: readonly string[], host: FileHost): ReadText {
  const real = directories.map((d) => host.realPath(d)).filter((d): d is string => d !== undefined);
  return (file): string | undefined | ReadRefused => {
    const at = host.realPath(file);
    if (at === undefined || !host.isFile(at)) return undefined;
    if (!real.some((d) => inside(at, d, host.separator)))
      return { refused: `${file} is outside the directories the loader may read (${directories.join(", ")})${at === file ? "" : `: it leads to ${at}`}` };
    return host.read(at);
  };
}
