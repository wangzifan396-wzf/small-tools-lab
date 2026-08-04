param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Question
)

# Set OLLAMA_MODELS in your shell first if Ollama uses a custom model directory.
$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  $python = "python"
}

& $python -m app ask $Question --capture
