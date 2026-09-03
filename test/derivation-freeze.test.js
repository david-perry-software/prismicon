import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveV1 } from '../src/core.js';

// Captured from the frozen v1 engine at commit 9204c26 (prismicon 1.0.1).
// deriveV1 identities are the package's public contract: adding motion/ring
// states must never alter these values.
const FROZEN = JSON.parse(`{
  "maya": {"spec":"v1","seed":"maya","hash":5672938920960816,"n":3,"solidType":0,"finish":1,"prop":0.75,"axisMode":0,"speed":-0.6900650275871157,"phase":4.301740389782586,"precess":false,"zSpeed":-0.17998544714646414,"phase2":1.8459765366751855,"hue":8,"hue2":145},
  "build-bot-7": {"spec":"v1","seed":"build-bot-7","hash":3896363917569,"n":4,"solidType":1,"finish":2,"prop":1.3,"axisMode":1,"speed":0.7468891458353027,"phase":3.8428703853993285,"precess":false,"zSpeed":-0.12171955700032414,"phase2":6.1943007512039125,"hue":275,"hue2":25},
  "Alice@X.com": {"spec":"v1","seed":"alice@x.com","hash":7287120426219225,"n":3,"solidType":2,"finish":0,"prop":0.75,"axisMode":0,"speed":-0.617978259245865,"phase":0.022091764370660297,"precess":true,"zSpeed":-0.16416204493725672,"phase2":3.4083078547770636,"hue":275,"hue2":25}
}`);

test('deriveV1 identities are frozen across engine changes', () => {
  for (const [seed, expected] of Object.entries(FROZEN)) {
    assert.deepEqual(deriveV1(seed), expected);
  }
});
