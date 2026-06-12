/**
 * Records a demo GIF of the JSONL Viewer extension.
 *
 * Launches an isolated VS Code instance (separate user-data/extensions dirs),
 * installs the packaged .vsix, drives the UI over the Chrome DevTools Protocol
 * with playwright-core, captures frames, and assembles demo.gif with ffmpeg.
 *
 * Usage: node scripts/record-demo.js
 */
const { chromium } = require('playwright-core');
const ffmpeg = require('ffmpeg-static');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const REPO = path.resolve(__dirname, '..');
const APP = '/Applications/Visual Studio Code.app';
const ELECTRON = path.join(APP, 'Contents/MacOS/Electron');
const CODE_CLI = path.join(APP, 'Contents/Resources/app/bin/code');
const CDP_PORT = 9457;
const GIF = path.join(REPO, 'demo.gif');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForCdp(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/json/version' }, (res) => {
        res.resume();
        res.statusCode === 200 ? resolve() : retry();
      });
      req.on('error', retry);
      function retry() {
        if (Date.now() > deadline) return reject(new Error('CDP endpoint never came up'));
        setTimeout(poll, 250);
      }
    };
    poll();
  });
}

async function main() {
  const vsix = fs.readdirSync(REPO).filter((f) => f.endsWith('.vsix')).sort().pop();
  if (!vsix) throw new Error('No .vsix found — run `vsce package` first.');

  // --- isolated sandbox -----------------------------------------------------
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-demo-'));
  const userDataDir = path.join(work, 'user-data');
  const extensionsDir = path.join(work, 'extensions');
  const demoDir = path.join(work, 'demo');
  const framesDir = path.join(work, 'frames');
  for (const d of [userDataDir, extensionsDir, demoDir, framesDir]) fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(path.join(REPO, 'sample.jsonl'), path.join(demoDir, 'sample.jsonl'));

  fs.mkdirSync(path.join(userDataDir, 'User'), { recursive: true });
  fs.writeFileSync(
    path.join(userDataDir, 'User', 'settings.json'),
    JSON.stringify(
      {
        'workbench.startupEditor': 'none',
        'workbench.tips.enabled': false,
        'window.zoomLevel': 1,
        'editor.minimap.enabled': false,
        'update.mode': 'none',
        'extensions.ignoreRecommendations': true,
        'security.workspace.trust.enabled': false,
        'telemetry.telemetryLevel': 'off',
      },
      null,
      2
    )
  );

  console.log(`Installing ${vsix} into sandbox...`);
  execFileSync(CODE_CLI, [
    '--user-data-dir', userDataDir,
    '--extensions-dir', extensionsDir,
    '--install-extension', path.join(REPO, vsix),
  ], { stdio: 'inherit' });

  // --- launch VS Code -------------------------------------------------------
  console.log('Launching VS Code...');
  const child = spawn(ELECTRON, [
    `--user-data-dir=${userDataDir}`,
    `--extensions-dir=${extensionsDir}`,
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-telemetry',
    '--new-window',
    demoDir,
  ], { stdio: 'ignore' });

  try {
    await waitForCdp(CDP_PORT);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);

    // Find the workbench page.
    let page;
    for (let i = 0; i < 60 && !page; i++) {
      page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('workbench.html'));
      if (!page) await sleep(500);
    }
    if (!page) throw new Error('Could not find VS Code workbench page');

    await page.waitForSelector('.monaco-workbench', { timeout: 30000 });
    await sleep(3000); // let the workbench settle

    // Open sample.jsonl via Quick Open.
    await page.keyboard.press('Meta+KeyP');
    await sleep(600);
    await page.keyboard.type('sample.jsonl', { delay: 30 });
    await sleep(400);
    await page.keyboard.press('Enter');
    await page.waitForSelector('.view-line', { timeout: 15000 });
    await sleep(800);

    // Hide the sidebar and auxiliary (chat) bar so both editor columns get space.
    await page.keyboard.press('Meta+KeyB');
    await sleep(400);
    await page.keyboard.press('Meta+Alt+KeyB');
    await sleep(600);

    const leftGroup = page.locator('.editor-group-container').first();
    const lineIn = (text) => leftGroup.locator('.view-line', { hasText: text }).first();
    // Click near the line start so the editor never scrolls horizontally.
    const clickLine = (text) => lineIn(text).click({ position: { x: 8, y: 8 } });

    // Cursor on row 1 before recording starts.
    await clickLine('Ada Lovelace');
    await sleep(400);

    // --- record -----------------------------------------------------------
    console.log('Recording...');
    let recording = true;
    const t0 = Date.now();
    const capture = (async () => {
      let i = 0;
      while (recording) {
        try {
          const buf = await page.screenshot({ type: 'png' });
          fs.writeFileSync(path.join(framesDir, `frame-${String(i).padStart(5, '0')}.png`), buf);
          i++;
        } catch { /* window busy; skip frame */ }
      }
      return i;
    })();

    await sleep(1200);
    await page.keyboard.press('Meta+Alt+KeyJ'); // JSONL: Preview Row
    await sleep(2600);
    await clickLine('Grace Hopper');
    await sleep(2000);
    await clickLine('Broken Row');
    await sleep(2200);
    await clickLine('Katherine Johnson');
    await sleep(2600);

    recording = false;
    const frameCount = await capture;
    const elapsed = (Date.now() - t0) / 1000;
    const inFps = Math.max(1, +(frameCount / elapsed).toFixed(2));
    console.log(`Captured ${frameCount} frames in ${elapsed.toFixed(1)}s (~${inFps} fps)`);

    await browser.close().catch(() => {});

    // --- encode GIF ---------------------------------------------------------
    console.log('Encoding GIF...');
    const palette = path.join(work, 'palette.png');
    const scale = 'fps=10,scale=960:-1:flags=lanczos';
    execFileSync(ffmpeg, [
      '-y', '-framerate', String(inFps), '-i', path.join(framesDir, 'frame-%05d.png'),
      '-vf', `${scale},palettegen=stats_mode=diff`, palette,
    ], { stdio: 'inherit' });
    execFileSync(ffmpeg, [
      '-y', '-framerate', String(inFps), '-i', path.join(framesDir, 'frame-%05d.png'), '-i', palette,
      '-lavfi', `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
      GIF,
    ], { stdio: 'inherit' });

    const mb = (fs.statSync(GIF).size / 1024 / 1024).toFixed(2);
    console.log(`\nDone: ${GIF} (${mb} MB)`);
  } finally {
    child.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
