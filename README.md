<div align="center">
  <img width="150px" src="public/icon.svg" alt="VidTagHub Logo" />
</div>

<div align="center">

# VidTagHub

✨ 对本地视频、图片进行分类管理的桌面工具

[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey?style=for-the-badge)](https://github.com/YSnowhere/VidTagHub/releases)

</div>

## 📦 功能

### 🗂️ 库管理
- 多库管理：每个库对应一个用户指定的本地文件夹，自动扫描其中的视频与图片
- 导入文件：将选中的媒体文件复制进当前库的文件夹并自动入库
- 重新扫描、删除库（删除库会连同其文件夹及文件一并删除，删除前有确认提示）

### 🏷️ 标签与分类
- 标签按「分类」组织（如：动漫、真人），分类与「库」并列为左侧导航入口
- 每个标签可设置封面图片，用于检索界面展示
- NSFW 作为独立限制标签：按媒体设置，默认隐藏，可在侧边栏开启显示

### 🔍 按标签检索
- 分区式浏览：分类总览 → 分类下的标签卡片（带封面）
- 检索结果按当前所在的库统计（支持「全部」），可在检索界面直接切换库
- 支持「返回上级」「回到主页」导航

### 🧲 搜索
- 多关键词搜索：多个搜索词用空格分隔
- 可自定义搜索范围：按文件名 / 按标签 / 按简介
- 多词匹配支持「交集」（需同时满足）与「并集」（满足任一即可）

### 🖼️ 媒体管理
- 自定义封面：选择图片，或对视频「从视频截帧」选取某一帧（不修改原视频）
- 为媒体编写简介
- 直接重命名文件（不填扩展名会自动保留原扩展名）
- 调用外部播放器（PotPlayer）播放，可在设置中选择或自动检测播放器路径

### 💾 数据存储
- 媒体数据（标签引用、简介、封面等）保存在库文件夹内的 `.vision-library.json`，随库迁移
- 标签与分类保存在用户数据目录的 `vision-tags.json`（与库无关）
- 库列表与设置保存在用户数据目录的 `vision-libraries.json`

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

- `release\VidTagHub Setup 0.1.0.exe` —— NSIS 安装程序
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

[MIT License](LICENSE) © 2026 [YSnowhere](https://github.com/YSnowhere)