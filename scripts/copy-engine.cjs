/**
 * copy-engine.cjs
 * Copies the Stockfish WASM engine files from node_modules into
 * public/engine/ so Vite serves them as static assets at runtime.
 */
const fs   = require('fs');
const path = require('path');

const src  = path.join(__dirname, '..', 'node_modules', 'stockfish');
const dest = path.join(__dirname, '..', 'public', 'engine');

// Files the stockfish package ships that we need served statically
const FILES = [
  'stockfish-nnue-16.js',
  'stockfish-nnue-16.wasm',
  'stockfish-nnue-16-single.js',
  'stockfish-nnue-16-single.wasm',
  'stockfish-16.js',
  'stockfish-16.wasm',
  'stockfish-16-single.js',
  'stockfish-16-single.wasm',
];

if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

let copied = 0;
for (const file of FILES) {
  const srcFile  = path.join(src, file);
  const destFile = path.join(dest, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`  ✓ copied ${file}`);
    copied++;
  }
}

if (copied === 0) {
  // stockfish not installed yet or ships different filenames — not fatal
  console.log('  ℹ  No stockfish engine files found (will work without engine features)');
} else {
  console.log(`  ✓ Engine files ready in public/engine/ (${copied} files)`);
}
