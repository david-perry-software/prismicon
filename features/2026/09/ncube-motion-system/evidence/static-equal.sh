#!/usr/bin/env bash
# Prove test/fixtures/golden-ncube-v1.json differs from origin/main only inside
# "mounted" blocks: compares the "static" objects of ncube and ncube-4.
set -u
cd "$(git rev-parse --show-toplevel)"
git show origin/main:test/fixtures/golden-ncube-v1.json | node -e '
  const fs = require("node:fs");
  const base = JSON.parse(fs.readFileSync(0, "utf8"));
  const work = JSON.parse(fs.readFileSync("test/fixtures/golden-ncube-v1.json", "utf8"));
  const same = ["ncube", "ncube-4"].every((id) =>
    JSON.stringify(base[id].static) === JSON.stringify(work[id].static));
  console.log("static-equal: " + same);
'
