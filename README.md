# Codex Pet Desktop

一个独立运行的 Electron 桌面宠物应用，兼容 Codex 风格的自定义宠物图集。它不依赖 Codex 启动或运行，只是复用了 `pet.json` + `spritesheet.webp` 的宠物资源格式，方便把已有宠物直接放到桌面上。

> 这是社区项目，不是 OpenAI 或 Codex 官方应用。

## 功能

- 透明、无边框、默认置顶的桌宠窗口。
- 透明空白区域默认鼠标穿透，不遮挡桌面点击。
- Windows 下默认不进任务栏，使用系统托盘图标控制显示、隐藏、重置位置、置顶和退出。
- 支持拖动桌宠到屏幕边缘和角落，窗口只保留最小可见区域避免完全拖丢。
- 支持单击招手、双击跳跃、自动游走、右键控制面板。
- 内置两只猫咪宠物：全白猫 `米粉` 和深色长毛虎斑猫 `米酒`。
- 可加载外部宠物目录，兼容 Codex 自定义宠物包。

## 交互

| 操作 | 行为 |
| --- | --- |
| 拖动桌宠 | 移动桌宠位置，拖动时暂停自动游走 |
| 单击桌宠 | 播放招手动画 |
| 双击桌宠 | 播放跳跃动画 |
| 右键 | 打开或关闭控制面板 |
| 系统托盘左键 | 显示或隐藏桌宠 |
| 系统托盘右键 | 打开菜单，支持显示、隐藏、重置、置顶、退出 |

控制面板支持切换宠物、切换动作状态、调整大小、开启/关闭自动游走、开启/关闭置顶、退出应用。

## 安装与运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run start
```

## Windows 打包

```bash
npm run dist:win
```

打包产物会输出到 `dist/`：

- `Codex Pet Desktop 0.1.0.exe`：便携版单文件，适合直接分发。
- `win-unpacked/Codex Pet Desktop.exe`：解包后的应用主程序，依赖同目录资源，适合调试。

也可以只生成解包目录：

```bash
npm run pack:win
```

## Mac 打包

目前 Mac 端脚本只保留了基础目录包：

```bash
npm run pack:mac
```

Windows 是当前优先支持的平台，Mac 端仍需要进一步适配菜单栏、权限和打包细节。

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
2. 应用内置资源目录 `resources/pets`。
3. 应用用户数据目录下的 `pets`。
4. `~/.codex/pets`。

如果多个目录里出现相同 `id` 的宠物，先扫描到的会优先使用。

## 开发检查

```bash
npm run smoke
```

这个检查会验证内置宠物可被加载，并验证桌宠窗口拖动边界逻辑。

也可以运行 Electron 启动冒烟检查：

```bash
PET_DESKTOP_E2E=1 npm run start
```

## 项目结构

```text
resources/pets/        内置宠物资源
src/main.js            Electron 主进程、窗口和托盘逻辑
src/preload.js         渲染进程安全 IPC 桥
src/renderer.*         桌宠界面、动画和交互逻辑
src/pets.js            宠物目录扫描和资源解析
src/windowBounds.js    桌宠拖动边界计算
src/smoke.js           本地冒烟检查
```

## 许可证

MIT
