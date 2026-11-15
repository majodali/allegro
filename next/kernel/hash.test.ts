// Tests of next/kernel/hash.ts against the vectors of FIPS 180-4 and of
// NIST's examples. Run by `npm run test:next`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256, sha256Text } from "./hash.js";

test("SHA-256 gives the standard's digests", () => {
  assert.equal(sha256Text(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Text("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Text("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"), "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  assert.equal(sha256(new Uint8Array(1_000_000).fill(0x61)), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
});

test("SHA-256 handles every padding length around a block", () => {
  const seen = new Set<string>();
  for (let n = 50; n <= 70; n++) seen.add(sha256(new Uint8Array(n)));
  assert.equal(seen.size, 21);
  assert.equal(sha256(new Uint8Array(55)), "02779466cdec163811d078815c633f21901413081449002f24aa3e80f0b88ef7");
  assert.equal(sha256(new Uint8Array(64)), "f5a5fd42d16a20302798ef6ed309979b43003d2320d9f0e8ea9831a92759fb4b");
});
