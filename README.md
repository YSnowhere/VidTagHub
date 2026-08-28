<div align="center">
  <img width="150px" src="public/icon.ico" alt="VidTagHub Logo" />
</div>

<div align="center">

# VidTagHub

✨ 对本地视频、图片进行分类管理的桌面工具

[![License](https://img.shields.io/github/license/YSnowhere/VidTagHub?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey?style=for-the-badge)](https://github.com/YSnowhere/VidTagHub/releases)

</div>

## 📦 功能

### 🗂️ 库管理
- 多库管理：每个库对应一个用户指定的本地文件夹，自动扫描其中的视频与图片

### 🏷️ 标签与分类
- 标签按「分类」组织，分类与「库」并列为左侧导航入口
- 每个标签可设置封面图片，用于检索界面展示
- 提供NSFW作为独立限制标签，方便隐藏隐私内容

### 🧲 搜索
- 多关键词搜索：多个搜索词用空格分隔
- 多目标搜索：按文件名 / 按标签 / 按简介
- 分区式浏览：按标签分类自由检索

### 🖼️ 媒体管理
- 自定义封面
- 为媒体编写简介
- 调用外部播放器播放

### 💾 数据存储
- 媒体数据随库迁移，卸载应用不删文件
- 无缝迁移应用数据，空间清理不费心

### 📚 系列功能
- 新增文件类型：系列
- 可方便的管理一组图片/多集视频

### 🎨 漫画阅读
- 对纯图片系列可以进入漫画阅读状态
- 支持多级系列，方便漫画分话管理

### ❓ 常见问题
- 初次导入「库」时，如遇卡顿，请等待图片加载完毕。
- 清理应用缓存后，重新打开「库」时，缓存可能需要重新加载
- 迁移数据时，建议您将数据保存在空文件夹中，以防丢失数据


## 🛠️ 技术栈

- 前端：React 18 + TypeScript + Redux Toolkit
- UI：Microsoft Fluent UI
- 桌面层：Electron
- 构建：CRACO + Electron Builder
- 包管理器：pnpm

## 🚀 快速开始

安装依赖（国内建议设置 Electron 镜像）：

```cmd
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
pnpm install
```

开发运行（React 热更新 + Electron 窗口）：

```cmd
pnpm dev
```

重新编译（产物在 `build/`）：

```cmd
rmdir /s /q build
rmdir /s /q release
pnpm build
```

打包安装程序（产物在 `release/`，首次打包需联网下载工具）：

```cmd
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
pnpm dist
```

- `release\VidTagHub Setup 0.2.0.exe` —— NSIS 安装程序
- `release\win-unpacked\` —— 免安装绿色版，可直接运行 `VidTagHub.exe`
- 版本号与产品名在 `package.json` 的 `version` 和 `build.productName` 中修改

## 📂 目录结构

```
├─ electron/          # Electron 主进程与预加载脚本（main.ts / preload.ts）
├─ src/
│  ├─ components/     # 界面组件（侧边栏、媒体网格、标签检索、详情面板、对话框等）
│  ├─ store/          # Redux Toolkit（data / ui）
│  ├─ services/       # 工具函数（格式化、播放、media:// 地址）
│  └─ types/          # 类型定义
├─ public/            # CRA 静态入口（含图标）
├─ craco.config.js
└─ package.json
```

## 📜 开源协议

本项目采用 **[Apache License 2.0](LICENSE)**。

- 允许自由使用、复制、修改、分发，包括商业用途
- 需保留版权声明与许可声明；修改的文件需标注变更
- © 2026 [YSnowhere](https://github.com/YSnowhere)