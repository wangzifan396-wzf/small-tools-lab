# Contributing

Preserve the read-only boundary: new behavior may inspect initialization or list metadata, but must never invoke tools, read resources, or retrieve prompt bodies. Add a bounded fake-server fixture and timeout test for protocol changes.
