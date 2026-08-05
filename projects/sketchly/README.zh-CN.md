# Sketchly

> 本地优先的手绘白板。无限画布、零依赖、可离线运行——你的画作永远不会离开你的设备。

Sketchly 是一个轻量的 Excalidraw / tldraw 替代品,**无需构建、无需服务器**即可运行。
所有数据都存在你的浏览器里(`localStorage`),没有账号、没有后端、没有任何网络请求。

## ✨ 功能

- **无限画布** —— 平移(空格拖拽 / 中键 / 滚轮)与缩放(Ctrl/⌘ + 滚轮,或按钮)。
- **手绘风格** —— 基于随机种子的「rough」渲染,呈现 Excalidraw 那种草图感,且平移缩放时不抖动。
- **图形** —— 画笔(自由绘制)、矩形、椭圆、菱形、箭头、直线、文本。
- **编辑** —— 选择、移动、缩放(8 个手柄)、多选、框选、删除。
- **样式** —— 描边色 / 填充色、线宽、手绘程度、不透明度。
- **撤销 / 重做** —— 完整历史记录(Ctrl/⌘+Z、Ctrl/⌘+Shift+Z)。
- **导出** —— PNG 图片(自动裁剪到内容范围)、JSON 场景文件;**导入**可恢复场景。
- **明亮 / 暗色主题** —— 跟随系统并可手动切换。
- **快捷键** —— 每个工具都有对应快捷键。

## 🚀 零安装上手

1. 下载 `dist/sketchly.html`(单文件)。
2. 双击打开 —— 在浏览器里直接可用,且离线运行。

就这么简单。不需要 `npm`,也不需要服务器。

## 🛠️ 开发者

```bash
git clone https://github.com/your-org/sketchly.git
cd sketchly
npm test          # 核心纯模块 22 个单元测试
npm run serve     # 本地预览 http://localhost:4173
npm run build     # 重新生成 dist/sketchly.html
```

### 目录结构

```
sketchly/
├── index.html           # 应用外壳(开发)
├── src/
│   ├── geometry.js      # 纯模块:坐标/包围盒/命中测试/缩放 (已测)
│   ├── scene.js         # 纯模块:元素模型 + 序列化/反序列化 (已测)
│   ├── store.js         # 纯模块:localStorage 持久化 (已测)
│   ├── render.js        # 画布渲染(清晰 + 手绘)
│   ├── theme.js         # 明暗主题
│   └── app.js           # 控制器:指针/键盘/UI 交互
├── test/                # node:test 单元测试
├── serve.js             # 零依赖静态服务器
├── build.js             # 单文件打包器
└── dist/sketchly.html   # 发布的单文件应用
```

**核心模块**(`geometry`、`scene`、`store`)不含任何 DOM,因此能在纯 Node 下跑
`node --test` —— 22 个单元测试覆盖的正是它们。

## ⌨️ 快捷键

| 按键 | 操作 | 按键 | 操作 |
| --- | ------ | --- | ------ |
| `V` | 选择 | `P` | 画笔 |
| `H` / `空格` | 平移 | `R` | 矩形 |
| `O` | 椭圆 | `D` | 菱形 |
| `A` | 箭头 | `L` | 直线 |
| `T` | 文本(或双击) | `Del` | 删除选中 |
| `Ctrl/⌘+Z` | 撤销 | `Ctrl/⌘+Shift+Z` | 重做 |
| `Ctrl/⌘+A` | 全选 | `+/-` / `0` | 缩放 / 重置 |

## 🔒 隐私

Sketchly **不做任何网络请求**。你的数据只存在于浏览器的 `localStorage`,键名为
`sketchly:v1`。用「导出 → 场景(JSON)」备份,用「导入」恢复。

## 📄 许可证

MIT © Sketchly contributors。
