# Skill Sentry · Agent Skill 安全扫描

安装 AI Agent Skill 之前，静态检查 `SKILL.md`、引用资源和技能包内脚本。零依赖、完全本地、规则可解释，不执行被扫描代码，也不会把内容交给云端模型。

```sh
node bin/skill-sentry.js path/to/skill
node bin/skill-sentry.js path/to/skills --fail-on medium
node bin/skill-sentry.js skill --format sarif --output skill-sentry.sarif
```

当前重点覆盖：

- 提示注入、隐藏行为与 Unicode 双向控制符
- 远程内容直接管道执行、编码载荷执行
- `rm -rf`、强制递归删除、危险 Git 命令
- 凭据文件 / 环境变量访问与网络外传组合
- 硬编码密钥、未固定版本的可执行依赖、过宽权限
- 越界 / 缺失引用与未被 `SKILL.md` 提及的脚本

输出支持终端、JSON、Markdown 和 SARIF。每条发现都有规则编号、严重度、文件行号、脱敏证据和修复建议。静态扫描不能证明技能绝对安全，高风险代码仍应人工复核并在受限环境运行。
