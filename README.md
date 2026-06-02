# 清录屏

清录屏是一款 Windows 桌面录屏工具，基于 Electron 构建。它支持屏幕录制、窗口录制、局部区域录制、系统声音、麦克风、录制倒计时、水滴悬浮窗、MP4 视频导出和 GIF 动图导出。

## 功能

- 选择屏幕或窗口作为录制来源
- 在预览中拖拽选择局部录制区域
- 录制前透明全屏 3 秒倒计时
- 录制开始后自动收起主窗口
- 水滴悬浮窗显示录制时长并可结束录制
- 水滴内部波纹跟随实际收声音量起伏
- 支持不录音、内置声音、外部麦克风
- 支持 MP4 和 GIF 输出
- 内置 ffmpeg，目标电脑无需额外安装转码工具

## 开发运行

```powershell
npm install
npm start
```

## 打包

```powershell
npm run pack
npm run dist
```

生成文件位于 `release/`。

## 分发

推荐分发以下文件之一：

```text
release/清录屏 Setup 1.0.0.exe
release/清录屏 1.0.0.exe
```

其中 `Setup` 是安装包，不带 `Setup` 的 exe 是便携版。

完整使用说明见 [使用说明.md](使用说明.md)。
