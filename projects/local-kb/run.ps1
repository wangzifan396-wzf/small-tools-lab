param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args
)

$python = "C:\Program Files\Python310\python.exe"
if (-not (Test-Path $python)) {
  $python = "python"
}

if ($Args.Count -eq 0) {
  $Args = @("serve")
}

& $python -m app @Args

