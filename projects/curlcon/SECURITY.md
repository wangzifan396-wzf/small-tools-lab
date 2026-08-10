# Security

curlcon parses text and never executes the supplied command. Shell pipelines, redirects, command substitutions, local-file flags, header files, cookie files, and multipart file uploads are rejected explicitly. Generated source quotes every user-controlled value.

The converter preserves credentials because that is necessary for faithful output. Review generated code before sharing it, and remove tokens, cookies, passwords, and private URLs. `--insecure` produces a visible warning and is never translated into advice to disable TLS globally. Report vulnerabilities through the repository [security policy](../../SECURITY.md).
