"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const serverPort = 4193;
const debugPort = 9333;
const writeScreenshots = process.argv.includes("--screenshots");
const temporaryProfile = fs.mkdtempSync(path.join(os.tmpdir(), "chromacraft-browser-"));

function browserCandidates() {
  if (process.platform === "win32") {
    return [
      process.env.CHROME_PATH,
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    ];
  }
  if (process.platform === "darwin") {
    return [
      process.env.CHROME_PATH,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    ];
  }
  return [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
}

function findBrowser() {
  const browser = browserCandidates().find((candidate) => candidate && fs.existsSync(candidate));
  if (!browser) throw new Error("Chrome, Edge, or Chromium was not found. Set CHROME_PATH.");
  return browser;
}

function waitForHttp(url, attempts) {
  return new Promise((resolve, reject) => {
    const tryRequest = (remaining) => {
      http.get(url, (response) => {
        response.resume();
        if (response.statusCode >= 200 && response.statusCode < 500) resolve();
        else if (remaining > 0) setTimeout(() => tryRequest(remaining - 1), 100);
        else reject(new Error(`Timed out waiting for ${url}`));
      }).on("error", () => {
        if (remaining > 0) setTimeout(() => tryRequest(remaining - 1), 100);
        else reject(new Error(`Timed out waiting for ${url}`));
      });
    };
    tryRequest(attempts);
  });
}

async function jsonFrom(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.sequence = 0;
    this.pending = new Map();
    this.events = [];
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function saveScreenshot(client, filename) {
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  fs.writeFileSync(path.join(projectRoot, "docs", filename), Buffer.from(screenshot.data, "base64"));
}

function waitForExit(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once("exit", resolve);
    setTimeout(resolve, 3000);
  });
}

async function validateViewport(client, name, width, height) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
    screenWidth: width,
    screenHeight: height
  });
  await client.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await client.send("Page.navigate", { url: `http://127.0.0.1:${serverPort}/` });
  await settle();
  await evaluate(client, "localStorage.clear(); location.reload(); true");
  await settle();

  const metrics = await evaluate(client, `(() => {
    const canvas = document.querySelector('#image-canvas');
    const context = canvas.getContext('2d');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const samples = new Set();
    for (let index = 0; index < pixels.length; index += Math.max(4, Math.floor(pixels.length / 400 / 4) * 4)) {
      samples.add(pixels[index] + ',' + pixels[index + 1] + ',' + pixels[index + 2]);
    }
    return {
      innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      canvasHidden: canvas.hidden,
      emptyHidden: document.querySelector('#empty-state').hidden,
      pixelColors: samples.size,
      swatches: document.querySelectorAll('.swatch-card').length,
      contrastCells: document.querySelectorAll('.contrast-cell').length,
      hasCssToken: document.querySelector('#code-output').textContent.includes('--color-1'),
      clippedButtons: Array.from(document.querySelectorAll('button')).filter((button) => button.offsetParent && button.scrollWidth > button.clientWidth + 1).length
    };
  })()`);

  assert.equal(metrics.innerWidth, width, `${name}: emulated width`);
  assert.equal(metrics.documentWidth, width, `${name}: document has horizontal overflow`);
  assert.equal(metrics.bodyWidth, width, `${name}: body has horizontal overflow`);
  assert.equal(metrics.canvasHidden, false, `${name}: sample canvas is visible`);
  assert.equal(metrics.emptyHidden, true, `${name}: empty state is hidden`);
  assert.ok(metrics.pixelColors > 8, `${name}: canvas has varied pixels`);
  assert.ok(metrics.swatches >= 3, `${name}: palette rendered`);
  assert.equal(metrics.contrastCells, metrics.swatches ** 2, `${name}: complete contrast matrix`);
  assert.equal(metrics.hasCssToken, true, `${name}: CSS tokens rendered`);
  assert.equal(metrics.clippedButtons, 0, `${name}: button labels fit`);

  if (writeScreenshots) {
    await evaluate(client, "scrollTo(0, 0); true");
    await saveScreenshot(client, `chromacraft-${name}.png`);
    if (name === "desktop") {
      await evaluate(client, "scrollTo(0, document.querySelector('.palette-band').offsetTop - 70); true");
      await settle();
      await saveScreenshot(client, "chromacraft-palette.png");
      await evaluate(client, "scrollTo(0, document.querySelector('.output-band').offsetTop - 70); true");
      await settle();
      await saveScreenshot(client, "chromacraft-output.png");
    }
  }

  if (name === "desktop") {
    const originalLockedHex = await evaluate(client, `(() => {
      const first = document.querySelector('.swatch-card');
      first.querySelector('[data-action="lock"]').click();
      return first.querySelector('[data-action="hex"]').value;
    })()`);
    await evaluate(client, `(() => {
      const range = document.querySelector('#color-count');
      range.value = '3';
      range.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await settle();
    const interaction = await evaluate(client, `(() => {
      document.querySelector('[data-format="json"]').click();
      return {
        swatches: document.querySelectorAll('.swatch-card').length,
        lockedHex: document.querySelector('.swatch-lock[aria-pressed="true"]')?.closest('.swatch-card')?.querySelector('[data-action="hex"]')?.value,
        json: document.querySelector('#code-output').textContent
      };
    })()`);
    assert.equal(interaction.swatches, 3, "desktop: palette size changes trigger extraction");
    assert.equal(interaction.lockedHex, originalLockedHex, "desktop: locked color survives extraction");
    assert.equal(Object.keys(JSON.parse(interaction.json).colors).length, 3, "desktop: JSON export follows palette state");
  }

  console.log(`${name}: ${width}x${height}, ${metrics.swatches} swatches, ${metrics.pixelColors} sampled canvas colors`);
}

async function main() {
  const server = spawn(process.execPath, [path.join(projectRoot, "scripts", "serve.js"), String(serverPort)], {
    cwd: projectRoot,
    stdio: "ignore"
  });
  const browser = spawn(findBrowser(), [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${temporaryProfile}`,
    "about:blank"
  ], { stdio: "ignore" });

  let client;
  try {
    await Promise.all([
      waitForHttp(`http://127.0.0.1:${serverPort}/`, 50),
      waitForHttp(`http://127.0.0.1:${debugPort}/json/list`, 50)
    ]);
    const targets = await jsonFrom(`http://127.0.0.1:${debugPort}/json/list`);
    const page = targets.find((target) => target.type === "page");
    assert.ok(page, "A browser page target is available");
    client = new CdpClient(page.webSocketDebuggerUrl);
    await client.open();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await validateViewport(client, "desktop", 1440, 1000);
    await validateViewport(client, "mobile", 390, 844);
  } finally {
    if (client) {
      await client.send("Browser.close").catch(() => {});
      client.close();
    } else {
      browser.kill();
    }
    server.kill();
    await Promise.all([waitForExit(browser), waitForExit(server)]);
    fs.rmSync(temporaryProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
