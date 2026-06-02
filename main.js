const { app, BrowserWindow, desktopCapturer, dialog, ipcMain, screen, shell } = require("electron");
const { execFile } = require("child_process");
const fsSync = require("fs");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

let mainWindow;
let countdownWindow;
let floatingWindow;

function getFfmpegPath() {
  const bundledPath = app.isPackaged
    ? path.join(process.resourcesPath, "bin", "ffmpeg.exe")
    : path.join(__dirname, "vendor", "ffmpeg", "ffmpeg.exe");

  if (fsSync.existsSync(bundledPath)) {
    return bundledPath;
  }

  return "ffmpeg";
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(getFfmpegPath(), args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        error.message = `${error.message}\n${stderr || stdout || ""}`;
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: "#f5f7fb",
    title: "清录屏",
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("window:minimize", () => mainWindow?.minimize());

ipcMain.handle("window:maximize", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});

ipcMain.handle("window:close", () => mainWindow?.close());

ipcMain.handle("capture:sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 420, height: 260 },
    fetchWindowIcons: true,
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    type: source.id.startsWith("screen:") ? "screen" : "window",
    thumbnail: source.thumbnail.toDataURL(),
    icon: source.appIcon?.isEmpty() ? null : source.appIcon?.toDataURL(),
  }));
});

ipcMain.handle("recording:save", async (_event, payload) => {
  const extension = payload.extension || "mp4";
  const fileLabel = extension.toUpperCase();
  const defaultName = `recording-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.show();
  mainWindow?.focus();
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "保存录屏",
    defaultPath: path.join(app.getPath("videos"), defaultName),
    filters: [{ name: `${fileLabel} 视频`, extensions: [extension] }],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const data = Buffer.from(payload.buffer);
  if (payload.transcodeToGif) {
    const tempInput = path.join(
      os.tmpdir(),
      `qing-recorder-${Date.now()}-${Math.random().toString(16).slice(2)}.${payload.sourceExtension || "webm"}`,
    );
    await fs.writeFile(tempInput, data);
    try {
      await runFfmpeg([
        "-y",
        "-i",
        tempInput,
        "-filter_complex",
        "[0:v]fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
        "-loop",
        "0",
        result.filePath,
      ]);
    } finally {
      fs.unlink(tempInput).catch(() => {});
    }
  } else if (payload.transcodeToMp4) {
    const tempInput = path.join(
      os.tmpdir(),
      `qing-recorder-${Date.now()}-${Math.random().toString(16).slice(2)}.${payload.sourceExtension || "webm"}`,
    );
    await fs.writeFile(tempInput, data);
    try {
      await runFfmpeg([
        "-y",
        "-i",
        tempInput,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        result.filePath,
      ]);
    } finally {
      fs.unlink(tempInput).catch(() => {});
    }
  } else {
    await fs.writeFile(result.filePath, data);
  }
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle("recording:show-file", async (_event, filePath) => {
  if (!filePath) return false;
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle("recording:countdown", async () => {
  if (countdownWindow && !countdownWindow.isDestroyed()) {
    countdownWindow.close();
  }

  const { bounds } = screen.getPrimaryDisplay();
  countdownWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      backgroundThrottling: false,
    },
  });

  countdownWindow.setAlwaysOnTop(true, "screen-saver");
  countdownWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  countdownWindow.setIgnoreMouseEvents(true);
  countdownWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="UTF-8" />
          <style>
            * { box-sizing: border-box; }
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              overflow: hidden;
              background: transparent;
              font-family: "Segoe UI", "Microsoft YaHei UI", sans-serif;
            }
            body {
              display: grid;
              place-items: center;
              color: white;
            }
            #num {
              font-size: clamp(150px, 22vw, 260px);
              font-weight: 900;
              line-height: .82;
              font-variant-numeric: tabular-nums;
              text-shadow:
                0 8px 32px rgba(0,0,0,.38),
                0 0 2px rgba(0,0,0,.5);
              animation: pop 1s ease both;
            }
            @keyframes pop {
              0% { transform: scale(.86); opacity: 0; }
              20% { transform: scale(1); opacity: 1; }
              100% { transform: scale(.96); opacity: .92; }
            }
          </style>
        </head>
        <body>
          <div id="num">3</div>
          <script>
            const num = document.querySelector("#num");
            let value = 3;
            setInterval(() => {
              value -= 1;
              if (value > 0) {
                num.textContent = value;
                num.style.animation = "none";
                requestAnimationFrame(() => {
                  num.style.animation = "pop 1s ease both";
                });
              }
            }, 1000);
          </script>
        </body>
      </html>
    `)}`,
  );

  countdownWindow.showInactive();

  await new Promise((resolve) => setTimeout(resolve, 3000));

  if (countdownWindow && !countdownWindow.isDestroyed()) {
    countdownWindow.close();
  }
  countdownWindow = null;
  mainWindow?.minimize();
  await new Promise((resolve) => setTimeout(resolve, 350));
  return true;
});

ipcMain.handle("recording:widget-show", async () => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.close();
  }

  const { workArea } = screen.getPrimaryDisplay();
  floatingWindow = new BrowserWindow({
    x: workArea.x + workArea.width - 172,
    y: workArea.y + 118,
    width: 172,
    height: 206,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "floating-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  floatingWindow.setAlwaysOnTop(true, "screen-saver");
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="UTF-8" />
          <style>
            * { box-sizing: border-box; }
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              overflow: hidden;
              background: transparent;
              font-family: "Segoe UI", "Microsoft YaHei UI", sans-serif;
              user-select: none;
            }
            .drop {
              -webkit-app-region: drag;
              position: relative;
              display: grid;
              align-content: center;
              justify-items: center;
              gap: 12px;
              width: 144px;
              height: 178px;
              margin: 10px;
              padding: 26px 14px 18px;
              border: 1px solid rgba(255,255,255,.54);
              border-radius: 54% 46% 57% 43% / 62% 58% 42% 38%;
              color: white;
              background:
                radial-gradient(circle at 35% 22%, rgba(255,255,255,.92), rgba(255,255,255,.24) 16%, transparent 18%),
                linear-gradient(155deg, rgba(42,126,255,.92), rgba(0,199,190,.88));
              box-shadow: 0 24px 58px rgba(0,122,255,.34), 0 10px 26px rgba(0,0,0,.18);
              overflow: hidden;
              transform: translateZ(0);
            }
            .drop::before,
            .drop::after {
              content: "";
              position: absolute;
              inset: 26px 18px auto;
              height: 58px;
              border: 1px solid rgba(255,255,255,.38);
              border-radius: 50%;
              opacity: .72;
              transform: translateY(calc(var(--level, 0) * 10px)) scale(calc(.82 + var(--level, 0) * .18));
              transition: transform 120ms ease, opacity 120ms ease;
            }
            .drop::after {
              inset: 58px 26px auto;
              height: 42px;
              opacity: .44;
              transform: translateY(calc(var(--level, 0) * -8px)) scale(calc(.88 + var(--level, 0) * .2));
            }
            .liquid {
              position: absolute;
              left: -18%;
              right: -18%;
              bottom: -12%;
              height: calc(38% + var(--level, 0) * 30%);
              background:
                radial-gradient(circle at 50% 0%, rgba(255,255,255,.55), transparent 34%),
                linear-gradient(180deg, rgba(255,255,255,.26), rgba(255,255,255,.08));
              border-radius: 46% 54% 0 0;
              transition: height 90ms linear;
              animation: wave 2.6s ease-in-out infinite;
            }
            .liquid::before {
              content: "";
              position: absolute;
              left: -20%;
              top: -16px;
              width: 140%;
              height: 34px;
              border-radius: 50%;
              background: rgba(255,255,255,.28);
              transform: translateX(calc(var(--level, 0) * 10px));
            }
            @keyframes wave {
              0%, 100% { transform: translateX(-2%) rotate(-1deg); }
              50% { transform: translateX(2%) rotate(1deg); }
            }
            .time {
              position: relative;
              z-index: 1;
              font-size: 18px;
              font-weight: 800;
              font-variant-numeric: tabular-nums;
              text-shadow: 0 2px 12px rgba(0,0,0,.22);
            }
            button {
              -webkit-app-region: no-drag;
              position: relative;
              z-index: 1;
              width: 70px;
              height: 32px;
              border: 0;
              border-radius: 999px;
              color: #ef4444;
              background: rgba(255,255,255,.92);
              font-size: 13px;
              font-weight: 800;
              cursor: pointer;
              box-shadow: 0 6px 18px rgba(0,0,0,.18);
            }
            button:hover { background: #fff; }
          </style>
        </head>
        <body>
          <div class="drop">
            <div class="liquid"></div>
            <div id="time" class="time">00:00</div>
            <button id="stop">结束</button>
          </div>
          <script>
            const drop = document.querySelector(".drop");
            const time = document.querySelector("#time");
            const startedAt = Date.now();
            const pad = (value) => String(value).padStart(2, "0");
            setInterval(() => {
              const total = Math.floor((Date.now() - startedAt) / 1000);
              time.textContent = pad(Math.floor(total / 60)) + ":" + pad(total % 60);
            }, 250);
            document.querySelector("#stop").addEventListener("click", () => {
              window.floatingRecorder.stop();
            });
            window.floatingRecorder.onLevel((level) => {
              const safe = Math.max(0, Math.min(Number(level) || 0, 1));
              drop.style.setProperty("--level", safe.toFixed(3));
            });
          </script>
        </body>
      </html>
    `)}`,
  );

  floatingWindow.showInactive();
  return true;
});

ipcMain.handle("recording:widget-close", () => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.close();
  }
  floatingWindow = null;
  return true;
});

ipcMain.handle("recording:widget-level", (_event, level) => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send("recording:level", Number(level) || 0);
  }
  return true;
});

ipcMain.handle("recording:stop-from-widget", () => {
  mainWindow?.webContents.send("recording:stop-request");
  return true;
});
