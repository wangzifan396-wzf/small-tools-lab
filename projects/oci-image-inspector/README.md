# OCI Image Inspector

A local, daemonless Docker save and OCI image-layout archive inspector. Review image platforms, references, layer sizes, build history, runtime configuration, environment variables, ports, users and provenance without pulling, extracting, mounting, or executing the image.

[Open the live tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/oci-image-inspector/)

## Why it is different

Large browser tools often read an entire image into memory. OCI Image Inspector performs a sparse scan: it reads 512-byte tar headers plus the small manifest and config JSON entries selected by Docker or OCI descriptors. Layer payloads are indexed by offset and size but never loaded or decompressed.

This makes local analysis practical for multi-gigabyte archives while keeping proprietary layers on the machine. The browser interface accepts uncompressed tar files up to 8 GiB, subject to browser and filesystem limits.

## Supported archives

- `docker save image -o image.tar` archives using `manifest.json`
- OCI Image Layout 1.0 archives using `oci-layout`, `index.json`, and content-addressed `blobs/`
- Multi-image Docker archives and multi-platform OCI indexes
- POSIX/ustar headers, GNU long names, local/global PAX metadata, octal and positive base-256 sizes

Gzip-wrapped tar files, Docker/OCI registries, directories, zstd-wrapped archives, encrypted layers and non-image OCI artifacts are not inspected. Decompress a gzip wrapper before opening it; inner compressed image layers remain untouched.

## Analysis

- Docker tags and OCI reference annotations
- OS, architecture, variant, creation time and author
- ordered layer size, compressed digest, rootfs DiffID and matching non-empty history command
- user, environment, labels, entrypoint, command, working directory, ports, volumes, stop signal and healthcheck
- secret-like environment names without exposing their values in findings
- credential assignments in retained build-history commands
- default/root users, missing commands, large or repeated layers, remote scripts piped to shells, floating tags, missing source/revision labels, debug configuration and sensitive exposed ports
- tar checksums, duplicate paths, unsafe absolute/parent paths, missing configs/layers/blobs and incompatible layout versions

Findings are transparent heuristics, not a vulnerability scan. The tool does not inspect packages or files inside layers; use SBOM Atlas for software inventories and SARIF Compass for scanner output.

## Redacted analysis export

The JSON export contains normalized metadata rather than raw manifests/configs. Values of secret-like environment variables are replaced, credential assignments in history/layer commands are redacted, and raw image config objects are omitted. Non-secret runtime metadata, paths, digests, labels and findings remain. Review exports before sharing them.

## Security model

Archive paths are never written to disk. Absolute paths, drive paths and `..` traversal segments are flagged and excluded from lookup. Descriptor digests must match a restricted algorithm-and-hex form before they can become blob paths. The tool never evaluates archive content or follows symlinks.

## Development

```bash
npm test
```

The dependency-free UMD core in `src/core.js` exposes synchronous byte-array and asynchronous Blob tar scanners, archive inspection, diagnostics, redacted analysis and byte formatting.
