const STORAGE_KEY = "todo-list";
const defaultTodos = [
  { id: 1, text: "整理项目文件", done: false },
  { id: 2, text: "完成静态页面", done: true },
  { id: 3, text: "检查渲染效果", done: false }
];
let todos = loadTodos();

const input = document.querySelector("#todo-input");
const addButton = document.querySelector(".todo-input button");
const taskCount = document.querySelector("#task-count");
const clearDoneButton = document.querySelector("#clear-done");

function loadTodos() {
  try {
    const savedTodos = localStorage.getItem(STORAGE_KEY);

    if (savedTodos) {
      return JSON.parse(savedTodos);
    }
  } catch (error) {
    return [];
  }

  return defaultTodos;
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function addTodo() {
  const text = input.value.trim();

  if (!text) {
    return;
  }

  todos.push({
    id: Date.now(),
    text,
    done: false
  });

  input.value = "";
  saveTodos();
  render();
}

function clearDoneTodos() {
  const activeTodos = todos.filter((todo) => !todo.done);

  if (activeTodos.length === todos.length) {
    return;
  }

  todos = activeTodos;
  saveTodos();
  render();
}

function render() {
  const list = document.querySelector("#todo-list");
  const doneCount = todos.filter((todo) => todo.done).length;

  taskCount.textContent = `已完成 ${doneCount} / ${todos.length} 项`;
  list.innerHTML = "";

  todos.forEach((todo) => {
    const item = document.createElement("li");
    item.className = todo.done ? "todo-item done" : "todo-item";

    const text = document.createElement("span");
    text.textContent = todo.text;
    text.addEventListener("click", () => {
      todo.done = !todo.done;
      saveTodos();
      render();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => {
      todos = todos.filter((item) => item.id !== todo.id);
      saveTodos();
      render();
    });

    item.append(text, deleteButton);
    list.append(item);
  });
}

addButton.addEventListener("click", addTodo);
clearDoneButton.addEventListener("click", clearDoneTodos);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addTodo();
  }
});

render();
