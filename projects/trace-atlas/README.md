# Trace Atlas

Analyze distributed traces locally before production releases. Trace Atlas accepts Jaeger JSON, OTLP JSON, or a small flat-span format; normalizes service/span timing, identifies errors, slow spans, HTTP failures, orphan parents, service latency, critical paths, and regressions between trace snapshots.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/trace-atlas/)

The tool follows the shape of OpenTelemetry spans and W3C Trace Context identifiers without connecting to a collector or backend. It never uploads trace data, executes attributes, or resolves external URLs. Timing units are normalized from common Jaeger microseconds, OTLP nanoseconds, and flat millisecond inputs. This is a focused local review aid, not a full OTLP validator or sampling-policy simulator.

References: [OpenTelemetry OTLP](https://opentelemetry.io/docs/specs/otlp/), [OpenTelemetry Trace API](https://opentelemetry.io/docs/specs/otel/trace/api/), and [W3C Trace Context](https://www.w3.org/TR/trace-context/).

Run `npm test` for the dependency-free core suite.
