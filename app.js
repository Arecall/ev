const api = window.screenRecorder;

const state = {
  sources: [],
  selectedSource: null,
  mode: "window",
  fps: 30,
  quality: "balanced",
  stream: null,
  previewReady: false,
  recorder: null,
  recordingStreams: [],
  stopCropPainter: null,
  stopAudioMeter: null,
  isSaving: false,
  isCountingDown: false,
  chunks: [],
  startedAt: 0,
  timer: null,
  region: null,
  dragStart: null,
  audioMode: "none",
  audioDeviceId: "",
  audioDevices: [],
  outputFormat: "mp4",
  recordingFormat: null,
  lastFilePath: "",
};

const qualityBits = {
  compact: 2_500_000,
  balanced: 5_000_000,
  crisp: 9_000_000,
};

const app = document.querySelector("#app");

app.innerHTML = `
  <div class="shell">
    <header class="titlebar">
      <div class="brand">
        <span class="brand-mark">REC</span>
        <div>
          <h1>清录屏</h1>
          <p>窗口、屏幕与局部录制</p>
        </div>
      </div>
      <div class="window-actions">
        <button class="icon-button" data-window="minimize" aria-label="最小化">
          <svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>
        </button>
        <button class="icon-button" data-window="maximize" aria-label="最大化">
          <svg viewBox="0 0 24 24"><path d="M7 7h10v10H7z"/></svg>
        </button>
        <button class="icon-button danger" data-window="close" aria-label="关闭">
          <svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/></svg>
        </button>
      </div>
    </header>

    <main class="workspace">
      <aside class="sidebar">
        <div class="section-title">
          <span>录制来源</span>
          <button id="refreshSources" class="ghost-button">刷新</button>
        </div>
        <div class="source-tabs" role="tablist">
          <button class="tab is-active" data-source-tab="all">全部</button>
          <button class="tab" data-source-tab="screen">屏幕</button>
          <button class="tab" data-source-tab="window">窗口</button>
        </div>
        <div id="sourceList" class="source-list"></div>
      </aside>

      <section class="stage-panel">
        <div class="toolbar">
          <div class="segmented" aria-label="录制模式">
            <button class="is-active" data-mode="window">
              <svg viewBox="0 0 24 24"><path d="M4 5h16v11H4zM9 20h6M12 16v4"/></svg>
              窗口
            </button>
            <button data-mode="region">
              <svg viewBox="0 0 24 24"><path d="M5 8V5h3M16 5h3v3M19 16v3h-3M8 19H5v-3M8 8h8v8H8z"/></svg>
              局部
            </button>
          </div>

          <div class="settings">
            <label>
              帧率
              <select id="fpsSelect">
                <option value="24">24 FPS</option>
                <option value="30" selected>30 FPS</option>
                <option value="60">60 FPS</option>
              </select>
            </label>
            <label>
              画质
              <select id="qualitySelect">
                <option value="compact">小体积</option>
                <option value="balanced" selected>均衡</option>
                <option value="crisp">清晰</option>
              </select>
            </label>
          </div>
        </div>

        <div id="previewStage" class="preview-stage">
          <video id="preview" autoplay muted playsinline></video>
          <div id="emptyState" class="empty-state">
            <svg viewBox="0 0 24 24"><path d="M4 6h16v12H4zM8 22h8M12 18v4"/></svg>
            <strong>选择一个窗口或屏幕开始预览</strong>
            <span>切换到局部模式后，可在预览区域拖拽选择录制范围。</span>
          </div>
          <div id="regionLayer" class="region-layer" aria-hidden="true">
            <div id="regionBox" class="region-box"></div>
          </div>
        </div>

        <div class="status-row">
          <div>
            <span id="statusDot" class="status-dot"></span>
            <span id="statusText">准备就绪</span>
          </div>
          <div id="regionText" class="region-text">全画面</div>
        </div>
      </section>

      <aside class="control-panel">
        <div class="record-card">
          <div class="timer" id="timer">00:00</div>
          <button id="recordButton" class="record-button">
            <span></span>
            开始录制
          </button>
          <button id="stopButton" class="stop-button" disabled>停止并保存</button>
        </div>

        <div class="tips">
          <h2>录制设置</h2>
          <label class="check-row">
            <input id="cursorCheck" type="checkbox" checked />
            显示鼠标指针
          </label>
          <label class="field-row">
            <span>声音来源</span>
            <select id="audioModeSelect">
              <option value="none" selected>不录音</option>
              <option value="system">内置声音</option>
              <option value="microphone">外部收声</option>
            </select>
          </label>
          <label id="microphoneRow" class="field-row is-hidden">
            <span>麦克风</span>
            <select id="microphoneSelect">
              <option value="">默认麦克风</option>
            </select>
          </label>
          <label class="field-row">
            <span>输出格式</span>
            <select id="outputFormatSelect">
              <option value="mp4" selected>MP4 视频</option>
              <option value="gif">GIF 动图</option>
            </select>
          </label>
          <div class="hint">
            内置声音录制电脑播放的声音，外部收声录制麦克风输入。GIF 不包含声音。
          </div>
        </div>

        <div id="savedPanel" class="saved-panel is-hidden">
          <span>已保存</span>
          <button id="showFileButton" class="ghost-button">打开位置</button>
        </div>
      </aside>
    </main>
  </div>
`;

const els = {
  sourceList: document.querySelector("#sourceList"),
  refreshSources: document.querySelector("#refreshSources"),
  previewStage: document.querySelector("#previewStage"),
  preview: document.querySelector("#preview"),
  emptyState: document.querySelector("#emptyState"),
  regionLayer: document.querySelector("#regionLayer"),
  regionBox: document.querySelector("#regionBox"),
  regionText: document.querySelector("#regionText"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  fpsSelect: document.querySelector("#fpsSelect"),
  qualitySelect: document.querySelector("#qualitySelect"),
  cursorCheck: document.querySelector("#cursorCheck"),
  audioModeSelect: document.querySelector("#audioModeSelect"),
  microphoneRow: document.querySelector("#microphoneRow"),
  microphoneSelect: document.querySelector("#microphoneSelect"),
  outputFormatSelect: document.querySelector("#outputFormatSelect"),
  recordButton: document.querySelector("#recordButton"),
  stopButton: document.querySelector("#stopButton"),
  timer: document.querySelector("#timer"),
  savedPanel: document.querySelector("#savedPanel"),
  showFileButton: document.querySelector("#showFileButton"),
};

let activeTab = "all";

function setStatus(text, recording = false) {
  els.statusText.textContent = text;
  els.statusDot.classList.toggle("is-recording", recording);
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function stopPreviewStream() {
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  state.previewReady = false;
}

function cleanupRecordingResources() {
  state.stopCropPainter?.();
  state.stopCropPainter = null;
  state.stopAudioMeter?.();
  state.stopAudioMeter = null;
  state.recordingStreams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });
  state.recordingStreams = [];
  state.recorder = null;
  state.chunks = [];
  clearInterval(state.timer);
  state.timer = null;
}

function startAudioMeter(audioTracks) {
  state.stopAudioMeter?.();

  if (!audioTracks.length) {
    let frame = 0;
    let stopped = false;
    const idlePulse = () => {
      if (stopped) return;
      frame += 0.08;
      api.updateRecordingWidgetLevel(0.08 + Math.sin(frame) * 0.025);
      setTimeout(idlePulse, 120);
    };
    idlePulse();
    state.stopAudioMeter = () => {
      stopped = true;
      api.updateRecordingWidgetLevel(0);
    };
    return;
  }

  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.72;
  const source = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
  source.connect(analyser);

  const samples = new Uint8Array(analyser.fftSize);
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const value = (sample - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / samples.length);
    api.updateRecordingWidgetLevel(Math.min(1, rms * 5.2));
    setTimeout(tick, 80);
  };

  tick();
  state.stopAudioMeter = () => {
    stopped = true;
    source.disconnect();
    audioContext.close().catch(() => {});
    api.updateRecordingWidgetLevel(0);
  };
}

function sourceLabel(source) {
  return source.type === "screen" ? "屏幕" : "窗口";
}

function renderSources() {
  const visible = state.sources.filter((source) => activeTab === "all" || source.type === activeTab);

  if (!visible.length) {
    els.sourceList.innerHTML = `<div class="source-empty">没有找到可录制的来源</div>`;
    return;
  }

  els.sourceList.innerHTML = visible
    .map((source) => {
      const selected = state.selectedSource?.id === source.id ? "is-selected" : "";
      const icon = source.icon ? `<img class="source-icon" src="${source.icon}" alt="" />` : "";
      return `
        <button class="source-item ${selected}" data-source-id="${source.id}">
          <img class="source-thumb" src="${source.thumbnail}" alt="" />
          <span class="source-meta">
            <span>${icon}${escapeHtml(source.name)}</span>
            <small>${sourceLabel(source)}</small>
          </span>
        </button>
      `;
    })
    .join("");
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

async function loadSources() {
  setStatus("正在读取窗口列表");
  state.sources = await api.getSources();
  if (!state.selectedSource && state.sources.length) {
    state.selectedSource = state.sources[0];
    await startPreview(state.selectedSource);
  }
  renderSources();
  setStatus(state.previewReady ? "预览中" : "准备就绪");
}

async function loadAudioDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    state.audioDevices = devices.filter((device) => device.kind === "audioinput");
    els.microphoneSelect.innerHTML = [
      `<option value="">默认麦克风</option>`,
      ...state.audioDevices.map((device, index) => {
        const label = device.label || `麦克风 ${index + 1}`;
        return `<option value="${escapeHtml(device.deviceId)}">${escapeHtml(label)}</option>`;
      }),
    ].join("");
  } catch (error) {
    console.warn("Unable to enumerate microphones", error);
  }
}

async function startPreview(source) {
  stopPreviewStream();
  resetRegion();
  els.emptyState.classList.add("is-hidden");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: source.id,
        maxFrameRate: state.fps,
        cursor: els.cursorCheck.checked ? "always" : "never",
      },
    },
  });

  state.stream = stream;
  els.preview.srcObject = stream;
  await els.preview.play();
  await waitForVideoReady();
  state.previewReady = true;
}

function waitForVideoReady() {
  if (els.preview.videoWidth && els.preview.videoHeight) return Promise.resolve();
  return new Promise((resolve) => {
    els.preview.onloadedmetadata = () => resolve();
  });
}

function resetRegion() {
  state.region = null;
  els.regionBox.style.display = "none";
  updateRegionText();
}

function updateRegionText() {
  if (state.mode !== "region" || !state.region) {
    els.regionText.textContent = "全画面";
    return;
  }

  const mapped = mapRegionToVideo(state.region);
  els.regionText.textContent = `${Math.round(mapped.sw)} x ${Math.round(mapped.sh)}`;
}

function getVideoDisplayRect() {
  const stage = els.previewStage.getBoundingClientRect();
  const videoRatio = els.preview.videoWidth / Math.max(els.preview.videoHeight, 1);
  const stageRatio = stage.width / Math.max(stage.height, 1);
  let width = stage.width;
  let height = stage.height;
  let left = 0;
  let top = 0;

  if (videoRatio > stageRatio) {
    height = stage.width / videoRatio;
    top = (stage.height - height) / 2;
  } else {
    width = stage.height * videoRatio;
    left = (stage.width - width) / 2;
  }

  return { left, top, width, height };
}

function mapRegionToVideo(region) {
  const rect = getVideoDisplayRect();
  const x = Math.max(region.x - rect.left, 0);
  const y = Math.max(region.y - rect.top, 0);
  const width = Math.min(region.width, rect.width - x);
  const height = Math.min(region.height, rect.height - y);
  const scaleX = els.preview.videoWidth / rect.width;
  const scaleY = els.preview.videoHeight / rect.height;

  return {
    sx: Math.max(0, x * scaleX),
    sy: Math.max(0, y * scaleY),
    sw: Math.max(2, width * scaleX),
    sh: Math.max(2, height * scaleY),
  };
}

function updateRegionBox(region) {
  els.regionBox.style.display = "block";
  els.regionBox.style.left = `${region.x}px`;
  els.regionBox.style.top = `${region.y}px`;
  els.regionBox.style.width = `${region.width}px`;
  els.regionBox.style.height = `${region.height}px`;
}

function getVideoRecorderStream() {
  if (state.mode !== "region" || !state.region) {
    return new MediaStream(state.stream.getVideoTracks());
  }

  const mapped = mapRegionToVideo(state.region);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(mapped.sw);
  canvas.height = Math.round(mapped.sh);
  const context = canvas.getContext("2d", { alpha: false });
  let active = true;

  const paint = () => {
    if (!active) return;
    context.drawImage(
      els.preview,
      mapped.sx,
      mapped.sy,
      mapped.sw,
      mapped.sh,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    requestAnimationFrame(paint);
  };

  paint();
  const croppedStream = canvas.captureStream(state.fps);
  state.recordingStreams.push(croppedStream);
  state.stopCropPainter = () => {
    active = false;
  };
  return croppedStream;
}

async function getSystemAudioStream() {
  const audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "desktop",
      },
    },
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: state.selectedSource.id,
        maxFrameRate: 1,
      },
    },
  });

  audioStream.getVideoTracks().forEach((track) => track.stop());
  state.recordingStreams.push(audioStream);
  return audioStream;
}

async function getMicrophoneStream() {
  const audio = state.audioDeviceId
    ? { deviceId: { exact: state.audioDeviceId }, echoCancellation: false, noiseSuppression: false }
    : { echoCancellation: false, noiseSuppression: false };
  const microphoneStream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
  state.recordingStreams.push(microphoneStream);
  await loadAudioDevices();
  return microphoneStream;
}

async function getAudioTracks() {
  if (state.audioMode === "none") return [];
  const stream =
    state.audioMode === "system" ? await getSystemAudioStream() : await getMicrophoneStream();
  return stream.getAudioTracks();
}

async function getRecorderStream() {
  const videoStream = getVideoRecorderStream();
  const audioTracks = await getAudioTracks();
  startAudioMeter(audioTracks);
  return new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);
}

function getRecordingFormat() {
  const mp4Types = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    "video/mp4;codecs=h264,aac",
    "video/mp4",
  ];
  const webmTypes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const mp4MimeType = mp4Types.find((type) => MediaRecorder.isTypeSupported(type));
  if (mp4MimeType) {
    return {
      mimeType: mp4MimeType,
      extension: state.outputFormat,
      sourceExtension: "mp4",
      transcodeToMp4: false,
      transcodeToGif: state.outputFormat === "gif",
    };
  }

  const webmMimeType = webmTypes.find((type) => MediaRecorder.isTypeSupported(type));
  if (webmMimeType) {
    return {
      mimeType: webmMimeType,
      extension: state.outputFormat,
      sourceExtension: "webm",
      transcodeToMp4: state.outputFormat === "mp4",
      transcodeToGif: state.outputFormat === "gif",
    };
  }

  return null;
}

async function startRecording() {
  if (state.isSaving) {
    setStatus("正在保存上一段录制");
    return;
  }

  if (!state.stream || !state.previewReady) {
    setStatus("请先选择录制来源");
    return;
  }

  if (state.mode === "region" && !state.region) {
    setStatus("请先拖拽选择局部区域");
    return;
  }

  cleanupRecordingResources();
  state.chunks = [];

  try {
    const recorderStream = await getRecorderStream();
    const options = {
      videoBitsPerSecond: qualityBits[state.quality],
    };
    const recordingFormat = getRecordingFormat();
    if (!recordingFormat) {
      throw new Error("当前运行环境没有可用的视频编码器");
    }
    state.recordingFormat = recordingFormat;
    options.mimeType = recordingFormat.mimeType;

    state.recorder = new MediaRecorder(recorderStream, options);
    state.recorder.ondataavailable = (event) => {
      if (event.data?.size) state.chunks.push(event.data);
    };
    state.recorder.onstop = () => saveRecording();
    state.recorder.onerror = (event) => {
      console.error(event.error);
      setStatus("录制出错");
      api.closeRecordingWidget();
      cleanupRecordingResources();
    };

    state.isCountingDown = true;
    els.recordButton.disabled = true;
    els.stopButton.disabled = true;
    els.savedPanel.classList.add("is-hidden");
    setStatus("3 秒后开始录制");
    await api.showCountdown();
    state.isCountingDown = false;

    state.recorder.start(250);
    await api.showRecordingWidget();
    state.startedAt = Date.now();
    state.timer = setInterval(() => {
      els.timer.textContent = formatTime(Date.now() - state.startedAt);
    }, 250);

    document.body.classList.add("is-recording");
    els.stopButton.disabled = false;
    setStatus("正在录制", true);
  } catch (error) {
    console.error(error);
    state.isCountingDown = false;
    els.recordButton.disabled = false;
    els.stopButton.disabled = true;
    api.closeRecordingWidget();
    cleanupRecordingResources();
    const message = error?.message || "";
    const isSystemAudio = state.audioMode === "system";
    if (message.includes("MP4")) {
      setStatus("当前环境不支持 MP4 编码");
    } else {
      setStatus(
        message.includes("视频编码器")
          ? "当前环境没有可用的视频编码器"
          : isSystemAudio
            ? "无法录制内置声音，请换屏幕源或关闭音频"
            : "无法打开外部收声设备",
      );
    }
  }
}

function stopRecording() {
  if (state.isCountingDown || !state.recorder || state.recorder.state === "inactive") return;
  state.recorder.stop();
  clearInterval(state.timer);
  els.stopButton.disabled = true;
  setStatus("正在保存");
}

async function saveRecording() {
  state.isSaving = true;
  await api.closeRecordingWidget();
  const type = state.recordingFormat?.mimeType || "video/mp4";
  const extension = state.recordingFormat?.extension || "mp4";
  const blob = new Blob(state.chunks, { type });
  const buffer = await blob.arrayBuffer();

  try {
    const actionText = state.recordingFormat?.transcodeToGif
      ? "正在生成 GIF"
      : state.recordingFormat?.transcodeToMp4
        ? "正在转换 MP4"
        : "正在保存";
    setStatus(actionText);
    const result = await api.saveRecording(buffer, {
      extension,
      mimeType: type,
      sourceExtension: state.recordingFormat?.sourceExtension,
      transcodeToMp4: state.recordingFormat?.transcodeToMp4,
      transcodeToGif: state.recordingFormat?.transcodeToGif,
    });

    if (result.canceled) {
      setStatus("保存已取消");
      return;
    }

    state.lastFilePath = result.filePath;
    els.savedPanel.classList.remove("is-hidden");
    setStatus("录制已保存");
  } catch (error) {
    console.error(error);
    setStatus("保存失败");
  } finally {
    state.isSaving = false;
    document.body.classList.remove("is-recording");
    els.recordButton.disabled = false;
    els.stopButton.disabled = true;
    els.timer.textContent = "00:00";
    state.recordingFormat = null;
    cleanupRecordingResources();
  }
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  els.regionLayer.classList.toggle("is-enabled", mode === "region");
  updateRegionText();
}

document.querySelectorAll("[data-window]").forEach((button) => {
  button.addEventListener("click", () => api.window[button.dataset.window]());
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

document.querySelectorAll("[data-source-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.sourceTab;
    document.querySelectorAll("[data-source-tab]").forEach((tab) => {
      tab.classList.toggle("is-active", tab === button);
    });
    renderSources();
  });
});

els.sourceList.addEventListener("click", async (event) => {
  const item = event.target.closest("[data-source-id]");
  if (!item) return;
  const source = state.sources.find((entry) => entry.id === item.dataset.sourceId);
  if (!source) return;
  state.selectedSource = source;
  renderSources();
  setStatus("正在启动预览");
  try {
    await startPreview(source);
    setStatus("预览中");
  } catch (error) {
    setStatus("无法打开该来源");
    console.error(error);
  }
});

els.refreshSources.addEventListener("click", loadSources);

els.fpsSelect.addEventListener("change", async () => {
  state.fps = Number(els.fpsSelect.value);
  if (state.selectedSource && !state.recorder) await startPreview(state.selectedSource);
});

els.qualitySelect.addEventListener("change", () => {
  state.quality = els.qualitySelect.value;
});

els.cursorCheck.addEventListener("change", async () => {
  if (state.selectedSource && !state.recorder) await startPreview(state.selectedSource);
});

els.audioModeSelect.addEventListener("change", async () => {
  state.audioMode = els.audioModeSelect.value;
  els.microphoneRow.classList.toggle("is-hidden", state.audioMode !== "microphone");
  if (state.audioMode === "microphone") await loadAudioDevices();
});

els.microphoneSelect.addEventListener("change", () => {
  state.audioDeviceId = els.microphoneSelect.value;
});

els.outputFormatSelect.addEventListener("change", () => {
  state.outputFormat = els.outputFormatSelect.value;
});

els.recordButton.addEventListener("click", startRecording);
els.stopButton.addEventListener("click", stopRecording);
els.showFileButton.addEventListener("click", () => api.showFile(state.lastFilePath));
api.onStopRequest(() => stopRecording());

els.previewStage.addEventListener("pointerdown", (event) => {
  if (state.mode !== "region" || !state.previewReady || state.recorder) return;
  const stage = els.previewStage.getBoundingClientRect();
  const x = event.clientX - stage.left;
  const y = event.clientY - stage.top;
  state.dragStart = { x, y };
  state.region = { x, y, width: 0, height: 0 };
  updateRegionBox(state.region);
  els.previewStage.setPointerCapture(event.pointerId);
});

els.previewStage.addEventListener("pointermove", (event) => {
  if (!state.dragStart || state.mode !== "region") return;
  const stage = els.previewStage.getBoundingClientRect();
  const currentX = Math.min(Math.max(event.clientX - stage.left, 0), stage.width);
  const currentY = Math.min(Math.max(event.clientY - stage.top, 0), stage.height);
  const x = Math.min(currentX, state.dragStart.x);
  const y = Math.min(currentY, state.dragStart.y);
  const width = Math.abs(currentX - state.dragStart.x);
  const height = Math.abs(currentY - state.dragStart.y);
  state.region = { x, y, width, height };
  updateRegionBox(state.region);
  updateRegionText();
});

els.previewStage.addEventListener("pointerup", (event) => {
  if (!state.dragStart) return;
  els.previewStage.releasePointerCapture(event.pointerId);
  state.dragStart = null;
  if (!state.region || state.region.width < 12 || state.region.height < 12) {
    resetRegion();
    setStatus("局部区域太小");
    return;
  }
  updateRegionText();
  setStatus("局部区域已选择");
});

window.addEventListener("beforeunload", stopPreviewStream);
window.addEventListener("beforeunload", () => api.closeRecordingWidget());

Promise.allSettled([loadSources(), loadAudioDevices()]).then((results) => {
  const sourceResult = results[0];
  if (sourceResult.status === "rejected") {
    console.error(sourceResult.reason);
    setStatus("读取录制来源失败");
  }
});
