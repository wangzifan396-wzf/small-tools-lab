# Security

Agent Trace reads only the file or directory explicitly provided by the caller. Directory discovery skips symlinks, `.git`, and `node_modules`; individual inputs are capped at 50 MiB.

Reports omit message bodies and tool-output bodies. They may still contain local paths and hostnames, so review a report before publishing it. The analyzer never makes network requests.

Report vulnerabilities privately through the toolbox policy in [SECURITY.md](../../SECURITY.md).
