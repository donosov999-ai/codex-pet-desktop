# 互联网永生计划

永生计划是一个独立运行的 Tauri/Rust 桌面宠物应用，兼容 Codex 风格的自定义宠物图集。它不依赖 Codex 启动或运行，只是复用了 `pet.json` + `spritesheet.webp` 的宠物资源格式，方便把已有宠物直接放到桌面上。

> 这是社区项目，不是 OpenAI 或 Codex 官方应用。

## 功能

- 透明、无边框、默认置顶的桌宠窗口。
- 透明空白区域默认鼠标穿透，不遮挡桌面点击。
- Windows 下默认不进任务栏，使用系统托盘图标控制显示、隐藏、召回、暂停自动散步、打开资源库、打开数据目录、置顶和退出。
- 支持拖动桌宠到屏幕边缘和角落，窗口只保留最小可见区域避免完全拖丢。
- 支持单击招手、双击跳跃、自动游走、右键控制面板。
- 主程序不内置宠物资源，宠物通过独立 `.petpack` 资源包导入。
- 右键控制面板内置宠物资源库，可从 GitHub Pages 索引一键安装或更新宠物包。
- 右键控制面板内置资源管理：查看已安装宠物版本和来源、打开资源目录、卸载已导入资源。
- 右键控制面板支持检查主程序更新、宠物资源包更新，并可直接打开下载页。
- 导入 `.petpack` 前会先预览名称和版本；同 id 资源确认后覆盖应用数据目录里的旧版本。
- GitHub Pages 下载页展示宠物首帧预览，并提供动作帧视觉 QA 页面。
- 可加载外部宠物目录，兼容 Codex 自定义宠物包。

## 交互

| 操作 | 行为 |
| --- | --- |
| 拖动桌宠 | 移动桌宠位置，拖动时暂停自动游走 |
| 单击桌宠 | 播放招手动画 |
| 双击桌宠 | 播放跳跃动画 |
| 右键 | 打开或关闭控制面板 |
| 系统托盘左键 | 显示或隐藏桌宠 |
| 系统托盘右键 | 打开急救菜单，支持显示、隐藏、召回到屏幕中央、暂停/恢复自动散步、打开资源库、打开数据目录、置顶、退出 |

控制面板支持从资源库一键安装或更新宠物包、本地导入宠物包、导入前确认、切换宠物、切换动作状态、调整大小、开启/关闭自动游走、开启/关闭置顶、检查主程序和宠物资源更新、打开下载页、资源目录打开、卸载已导入宠物和退出应用。

## 下载

推荐先从 GitHub Releases 下载主程序。宠物资源可以在主程序的“宠物资源库”里一键安装，也可以从 GitHub Pages 下载 `.petpack` 后手动导入。

- `yongsheng-plan-windows-x64.exe`：Windows x64 主程序。
- `yongsheng-plan-macos-arm64.dmg`：Apple Silicon Mac 主程序。
- `yongsheng-plan-macos-x64.dmg`：Intel Mac 主程序。
- `mi-fen-1.0.2.petpack`：米粉宠物包。
- `mi-jiu-1.0.0.petpack`：米酒宠物包。
- `tigris-whippet-1.0.1.petpack`：红糖宠物包。

## 安装与运行

Rust/Tauri 是主实现。

```bash
cargo install tauri-cli --version "^2"
cd src-tauri
cargo run
```

开发模式会扫描仓库里的 `resources/pets`，方便预览和制作资源；正式安装包不内置这些资源。

## Windows 打包

Windows 打包建议在 Windows 环境或 GitHub Actions 中执行：

```bash
node scripts/build-app.js build windows
```

GitHub Actions 会在推送 `v*` tag 时自动构建主程序安装包并发布到 Releases。

## Mac 打包

macOS 打包建议在 macOS 环境或 GitHub Actions 中执行：

```bash
node scripts/build-app.js build macos-arm64
```

## 宠物包打包

```bash
node scripts/build-petpacks.js
```

生成文件位于 `release/petpacks/`。脚本会先校验每个资源包的 `pet.json`、`spritesheet.webp` 和图集尺寸，并输出 `release/petpacks/qa.json`。GitHub Pages workflow 会自动生成 `.petpack`、资源索引、首帧预览、动作帧视觉 QA 页面和下载页。

单独运行资源 QA：

```bash
node scripts/qa-petpack-assets.js
```

## 宠物资源格式

每个宠物是一个文件夹，至少包含：

```text
my-pet/
  pet.json
  spritesheet.webp
```

`pet.json` 示例：

```json
{
  "id": "mi-fen",
  "displayName": "米粉",
  "description": "米粉，一只全白猫咪，常态趴着待机。",
  "spritesheetPath": "spritesheet.webp"
}
```

`.petpack` 是 zip 容器，根目录包含：

```text
petpack.json
pet.json
spritesheet.webp
```

`petpack.json` 示例：

```json
{
  "format": "codex-petpack",
  "formatVersion": 1,
  "id": "mi-fen",
  "displayName": "米粉",
  "version": "1.0.0"
}
```

图集要求：

- 文件尺寸：`1536x1872`
- 网格：8 列 x 9 行
- 单帧：`192x208`

| 行号 | 状态 | 帧数 |
| --- | --- | --- |
| 0 | `idle` | 6 |
| 1 | `running-right` | 8 |
| 2 | `running-left` | 8 |
| 3 | `waving` | 4 |
| 4 | `jumping` | 5 |
| 5 | `failed` | 8 |
| 6 | `waiting` | 6 |
| 7 | `running` | 6 |
| 8 | `review` | 6 |

## 外部宠物目录

应用会按顺序扫描这些位置：

1. `CODEX_PETS_DIR` 环境变量指定的目录，多个目录按系统路径分隔符分开。
2. 应用用户数据目录下的 `pets`。
3. 应用内置资源目录。
4. `~/.codex/pets`。

如果多个目录里出现相同 `id` 的宠物，先扫描到的会优先使用。

## 开发检查

```bash
npm run smoke
```

这个检查会验证宠物资源格式、空宠物状态、导入预览确认、导入缓存刷新、中文界面文案、应用内资源库安装/更新、托盘命令响应、资源管理器、主程序和宠物资源更新入口、下载页生成、视觉 QA 页面和 workflow 配置。Rust 测试还会读取每个 `spritesheet.webp`，确认所有声明动作帧都有可见内容。

也可以运行 Tauri 启动冒烟检查：

```bash
cd src-tauri
PET_DESKTOP_E2E=1 cargo run
```

## 项目结构

```text
resources/pets/        用于生成独立 .petpack 的宠物资源
src-tauri/             Rust/Tauri 主进程、窗口、托盘、打包配置
src/app/               打包进主程序的前端运行时文件
src/*-smoke.js         Node 冒烟测试，不进入主程序前端运行目录
scripts/build-app.js   生成无内置资源的 Tauri 主程序安装包
scripts/build-petpacks.js 生成独立宠物资源包
scripts/qa-petpack-assets.js 校验宠物资源 manifest 和 spritesheet 尺寸
scripts/render-download-page.js 根据 petpacks.json 生成下载页
src/smoke.js           本地冒烟检查
```

## 许可证

MIT
