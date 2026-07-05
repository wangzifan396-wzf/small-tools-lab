# Project Tasks: 待办清单增强

> 目标仓库: `E:\ceshi`
> 执行者: Codex Executor
> 现有文件: `index.html` `style.css` `app.js` (三阶段均已完成，含 localStorage 持久化)

---

- [x] **任务 1: 添加任务计数器**

  在列表下方添加状态栏，显示"X / Y 项已完成"。修改 `index.html` 和 `app.js`，不修改 `style.css` 中已有规则，新增样式追加到 `style.css` 末尾。

  **修改范围:**
  - `index.html`: 在 `<ul id="todo-list">` 下方添加 `<div class="status-bar">`，内含一个 `<span id="task-count">`
  - `style.css`: 追加 `.status-bar` 样式——居中文字、灰色小字(`#8b9098`)、12px、上边距 16px
  - `app.js`: 每次 `render()` 更新 `#task-count` 的 `textContent`，格式为「已完成 X / Y 项」

  **验收标准:**
  - 页面加载时显示计数器，初始为"已完成 1 / 3 项"
  - 添加新任务后计数更新
  - 切换完成状态后计数更新
  - 删除任务后计数更新

  **完成备注:** 已在 `index.html` 添加状态栏和 `#task-count`，在 `style.css` 末尾追加 `.status-bar` 样式，并在 `app.js` 的 `render()` 中更新「已完成 X / Y 项」。已通过 Playwright 验证页面加载、添加、切换完成状态、删除任务后的计数更新。

- [x] **任务 2: 添加"清除已完成"按钮**

  在状态栏右侧添加一个"清除已完成"按钮，点击后移除所有 `done: true` 的条目。

  **修改范围:**
  - `index.html`: 在 `.status-bar` 内追加 `<button id="clear-done">清除已完成</button>`
  - `style.css`: 追加 `#clear-done` 样式——透明背景、红色文字(`#dc2626`)、1px 红色边框、圆角 4px、光标 pointer（参照已有按钮风格但用 ghost 样式区分）
  - `app.js`: 给 `#clear-done` 绑 click 事件，`todos = todos.filter(t => !t.done)`，然后 `saveTodos()` + `render()`

  **验收标准:**
  - 存在至少 1 条已完成任务时，点"清除已完成"后该项消失
  - 全部清除后计数器同步更新
  - 无已完成任务时点击按钮无副作用（不崩溃、不产生空列表异常）

  **完成备注:** 已在 `index.html` 的 `.status-bar` 内追加 `#clear-done` 按钮，在 `style.css` 中追加 ghost 风格按钮样式，并在 `app.js` 中添加 `clearDoneTodos()` 点击处理，移除所有 `done: true` 条目后执行 `saveTodos()` + `render()`。已通过 Playwright CLI 验证默认已完成项和新增已完成项可被清除、计数器同步更新、无已完成项时再次点击无副作用。

- [ ] **任务 3: 添加过滤器（全部 / 进行中 / 已完成）**

  在输入区和列表之间添加三个过滤按钮，切换当前显示的列表范围。

  **修改范围:**
  - `index.html`: 在 `.todo-input` 和 `#todo-list` 之间插入 `<div class="filters">`，内含三个 `<button>`：
    - `<button class="filter-btn active" data-filter="all">全部</button>`
    - `<button class="filter-btn" data-filter="active">进行中</button>`
    - `<button class="filter-btn" data-filter="done">已完成</button>`
  - `style.css`: 追加 `.filters` 居中 flex 布局、按钮间 gap 8px、margin-bottom 12px；`.filter-btn` 为灰色小字 ghost 按钮、`.filter-btn.active` 为蓝色高亮
  - `app.js`: 维护变量 `let currentFilter = "all"`；`render()` 内根据 `currentFilter` 过滤 `todos` 后再生成 DOM（`all` 全部、`active` 过滤 `!done`、`done` 过滤 `done`）；给三个按钮绑 click 切换 `.active` class 和 `currentFilter` 值

  **验收标准:**
  - 点"全部"显示所有任务，点"进行中"只显示未完成，点"已完成"只显示已完成
  - 切换过滤器后计数器仍显示全局统计（不受过滤器影响）
  - 页面加载时"全部"按钮高亮

- [ ] **任务 4: 双击编辑任务文本**

  双击任务文本可进入编辑模式，修改后按 Enter 保存，按 Esc 取消。

  **修改范围:**
  - `app.js`: 在 `render()` 中，给每项的 span 添加 `dblclick` 事件：
    1. 创建 `<input>` 替换当前 span，初始值为 `todo.text`
    2. 给 input 添加样式：继承 span 字体、宽度自适应
    3. 给 input 绑 `keydown`: Enter 时 `todo.text = input.value.trim()`，非空则保存并 `saveTodos()` + `render()`；Esc 时直接 `render()`（放弃编辑）
    4. 给 input 绑 `blur`: 失焦时同上保存逻辑
    5. input 创建后自动 `focus()` 并全选文本
  - `style.css`: 追加编辑态 input 样式——`font-size: 14px`、`border: 1px solid #2563eb`、`padding: 2px 6px`、`border-radius: 4px`

  **验证标准:**
  - 双击任务文本出现输入框，内容被全选
  - 修改后按 Enter，列表更新并持久化
  - 修改后点输入框外部（失焦），同样保存
  - 按 Esc 放弃编辑，文本恢复原值
  - 编辑为空文本时按 Enter 不保存

- [ ] **任务 5: 最终验收检查**

  通读三个文件，确保所有功能无回归，代码整洁。

  **检查清单（逐一确认，不得跳过）:**
  1. 打开 `index.html`，确认浏览器控制台无报错
  2. 添加 2 条新任务 — 计数器正确更新、数据持久化
  3. 使用三个过滤器切换 — 列表正确过滤
  4. 双击编辑任务 — 保存/取消均正常
  5. 清除已完成 — 仅移除已完成项
  6. 刷新页面 — 所有数据恢复
  7. 检查 `style.css` 无重复选择器、无未使用规则
  8. 检查 `app.js` 无 `console.log` 调试残留、无未使用变量

  **验证标准:**
  - 以上 8 条全部通过
  - 如发现缺陷，自行修复后重新检查
