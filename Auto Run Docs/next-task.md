# Next Task: 过滤器 UI 骨架

> 执行者: Codex Executor
> 前置条件: 任务 1、2 已完成（`index.html` 含 `.status-bar`，`app.js` 含计数器与清除逻辑）

---

- [x] **添加过滤器 HTML 与 CSS**

  在输入区和列表之间插入三个过滤按钮（仅静态结构 + 样式，不写 JS 交互）。

  **修改范围:**
  - `index.html`: 在 `.todo-input` 和 `#todo-list` 之间插入：
    ```html
    <div class="filters">
      <button class="filter-btn active" data-filter="all">全部</button>
      <button class="filter-btn" data-filter="active">进行中</button>
      <button class="filter-btn" data-filter="done">已完成</button>
    </div>
    ```
  - `style.css`: 在文件末尾追加以下样式：
    - `.filters` — `display: flex; justify-content: center; gap: 8px; margin-bottom: 12px;`
    - `.filter-btn` — `border: 1px solid #c9ced6; border-radius: 4px; background: transparent; color: #8b9098; font-size: 12px; padding: 4px 10px; cursor: pointer;`
    - `.filter-btn.active` — `color: #2563eb; border-color: #2563eb;`
    - `.filter-btn:hover:not(.active)` — `background: #f5f6f8;`

  **验收标准:**
  - 打开 `index.html`，输入框和列表之间出现三个按钮：「全部」「进行中」「已完成」
  - 「全部」按钮默认高亮（蓝色文字 + 蓝色边框）
  - 三个按钮点击无反应（JS 未绑定，符合预期）

  **完成说明:** 已在 `index.html` 添加静态过滤器按钮，并在 `style.css` 末尾追加对应样式；未添加 JS 交互。
