# Screenshot QA

一个轻量的截图问答助手：

```text
截图/图片 -> OCR 提取文字 -> 本地 qwen 或 DeepSeek API 分析回答
```

它不能让纯文本模型真正“看见图片”，而是先把截图里的文字提取出来，再把文字交给模型分析。对报错截图、网页截图、代码截图、文档截图很实用。

## 参考项目

- PaddleOCR：功能强，识别能力好，但依赖和模型更重。
- Tesseract OCR：经典 OCR 引擎，但 Windows 需要单独安装程序和语言包。
- EasyOCR：上手简单，但依赖 PyTorch，体积较大。
- RapidOCR：基于 ONNXRuntime，适合轻量本地 OCR，本项目采用这条路线。

## 储存占用

项目代码本身小于 1MB。主要占用来自虚拟环境和 OCR 依赖：

```text
.venv + rapidocr-onnxruntime + onnxruntime + pillow: 通常几百 MB
截图历史: 取决于你保存多少 PNG
额外大模型: 不需要
```

如果你的 Ollama 模型已经下载过，这个项目不会重复下载它们。模型目录不在默认位置时，可以在运行前自行设置 `OLLAMA_MODELS`。

## 安装

在 `screenshot-qa` 目录：

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 本地模型问答

确保 Ollama 正在运行，并且能看到你的模型：

```powershell
# 可选：如果你的模型目录不在默认位置
$env:OLLAMA_MODELS = "D:\ollama-models"
ollama list
```

对一张图片提问：

```powershell
.\.venv\Scripts\python.exe -m app ask "这个截图里的报错是什么意思？" --image path\to\screenshot.png
```

直接截当前屏幕并提问：

```powershell
.\ask-screenshot.ps1 "这个截图里有什么问题？"
```

## DeepSeek API 问答

设置 API Key：

```powershell
$env:DEEPSEEK_API_KEY = "你的 key"
```

调用：

```powershell
.\.venv\Scripts\python.exe -m app ask "分析这个截图" --image path\to\screenshot.png --provider deepseek
```

注意：DeepSeek 会收到 OCR 提取出来的文字，不会收到原图。

## 命令

```powershell
# 截图到 data\screenshots
.\.venv\Scripts\python.exe -m app capture

# 只做 OCR
.\.venv\Scripts\python.exe -m app ocr --image path\to\screenshot.png

# OCR + 本地 qwen 回答
.\.venv\Scripts\python.exe -m app ask "这张图说了什么？" --image path\to\screenshot.png
```
