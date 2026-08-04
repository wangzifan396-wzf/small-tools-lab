from __future__ import annotations

import datetime as dt
import subprocess
from pathlib import Path

from .config import SCREENSHOT_DIR


def capture_screen(output_path: Path | None = None) -> Path:
    if output_path is None:
        timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        output_path = SCREENSHOT_DIR / f"screenshot-{timestamp}.png"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    escaped = str(output_path).replace("'", "''")
    script = f"""
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Drawing.Rectangle]::Empty
foreach ($screen in [System.Windows.Forms.Screen]::AllScreens) {{
  $bounds = [System.Drawing.Rectangle]::Union($bounds, $screen.Bounds)
}}
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save('{escaped}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
"""
    subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
        check=True,
        capture_output=True,
        text=True,
    )
    return output_path

