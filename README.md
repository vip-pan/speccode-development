# speccode-development

Claude Code marketplace：托管 speccode 及未来相关插件。

## 插件列表

| 插件 | 说明 | 版本 |
|---|---|---|
| [speccode](./plugins/speccode/) | 多需求并行开发 + spec 文档托管 + PR/MR 流程标准化的流程编排插件 | 0.2.0 |

## 安装

```bash
# 本地（开发/测试）
/plugin marketplace add /Users/<you>/workspaces/plugin/speccode-development
/plugin install speccode@speccode-development

# 远端（推到 GitHub 后）
/plugin marketplace add vip-pan/speccode-development
/plugin install speccode@speccode-development
```

安装后命令以 `/speccode:` 前缀出现，如 `/speccode:init`、`/speccode:status`、`/speccode:finishing-feature`。

## 开发

见 [CLAUDE.md](./CLAUDE.md)（开发视角：引擎三层架构、测试约定、OpenSpec 工作流）与 [plugins/speccode/README.md](./plugins/speccode/README.md)（用户文档：21 命令表、三层分支拓扑、风险）。
