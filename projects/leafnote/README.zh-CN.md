# Leafnote

**本地优先的 Markdown 笔记与知识库。** 零依赖、可离线、数据只存在你自己的设备上。

[English](./README.md)

---

Leafnote 是一个你真正**拥有**的轻量笔记应用。没有账号、没有服务器、没有埋点——
你的笔记保存在浏览器的 `localStorage` 中。它用最朴素的 ES 模块编写，方便阅读、复刻和扩展。

## ✨ 功能特性

- **Markdown 实时预览** —— 标题、加粗/斜体/删除线、代码、引用、表格、任务列表等。
- **双向链接（Wiki-link）** —— 用 `[[笔记标题]]` 关联笔记，点击即跳转；不存在的笔记会自动创建。
- **反向链接** —— 一眼看到有哪些笔记链接了当前笔记。
- **#标签** —— 为笔记打标签，并可在侧边栏按标签筛选。
- **全文搜索** —— 标题加权、多关键词排序。
- **亮色 / 暗色主题** —— 默认跟随系统，可随时切换。
- **导入 / 导出** —— 导入 `.md` 文件；单篇导出为 `.md`，或整库备份为 JSON。
- **防 XSS** —— 所有 Markdown 均做 HTML 转义，并屏蔽 `javascript:`、`data:` 等危险链接。

## 🚀 下载即用（无需构建）

整个应用就是**一个 HTML 文件**。下载
[`dist/leafnote.html`](./dist/leafnote.html)，**双击用浏览器打开**即可使用，离线也完全没问题。

> 笔记按「浏览器 + 站点」保存。清除站点数据、或换用其他浏览器/配置，将看不到原有笔记。
> 请善用「Backup JSON」功能保留一份可携带的备份。

## 🛠 本地开发

```bash
# 用极简零依赖静态服务器本地预览
npm run serve          # → http://localhost:4173

# 运行单元测试（33 个，零依赖）
npm test

# 重新生成单文件 dist/leafnote.html
npm run build
```

无需 `npm install` —— Leafnote 没有任何运行时依赖。

## 📁 目录结构

```
leafnote/
├── index.html          # 三栏应用骨架
├── src/
│   ├── app.js          # DOM 控制器（串联各模块）
│   ├── styles.css      # 亮/暗主题与响应式布局
│   ├── store.js        # localStorage 笔记存储 + JSON 备份
│   ├── markdown.js     # 防 XSS 的 Markdown → HTML 渲染器
│   ├── search.js       # 全文检索 + 反向链接
│   ├── theme.js        # 亮/暗主题处理
│   └── util.js         # 纯函数小工具
├── test/               # node:test 测试套件（无需 DOM）
├── serve.js            # 零依赖静态服务器
├── build.js            # 单文件打包器（内联 CSS + JS）
└── dist/leafnote.html  # 可下载、自包含的单文件构建
```

## 🔒 隐私

Leafnote **不会**向网络发送任何数据。没有统计、没有同步、没有远端服务器。你写下的内容只留在你的设备上。

## 📜 许可证

[MIT](./LICENSE) © Leafnote contributors。
