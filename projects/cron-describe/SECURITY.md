# Security

Cron Describe runs locally and has no network or telemetry code. Treat cron expressions and generated schedules as untrusted input when embedding the library in another application; escape them before inserting into HTML.

Report a vulnerability privately through the repository policy in [SECURITY.md](../../SECURITY.md).
