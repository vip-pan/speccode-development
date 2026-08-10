# plugin-packaging Delta

## ADDED Requirements

### Requirement: references 自包含与品牌中立

`plugins/speccode/references/` 下的辅助资源(脚本、模板、文档)SHALL 自包含:渲染产物 MUST NOT 引用第三方品牌标识(名称、logo、链接),MUST NOT 在运行时请求第三方远程资源(图片、脚本、样式);所需版本号、仓库链接等元数据 MUST 读自 `plugins/speccode/.claude-plugin/plugin.json`,MUST NOT 硬编码(读取失败时的兜底常量除外)或从不存在的路径探测。

#### Scenario: references 无第三方品牌残留
- **WHEN** 对 `plugins/speccode/references/` 全量文本检索 `superpowers|primeradiant|github.com/obra`(大小写不敏感)
- **THEN** 无任何匹配

#### Scenario: 版本与链接读自 plugin.json
- **WHEN** 检查 `visual-companion-scripts/server.cjs` 的元数据读取逻辑
- **THEN** 其 manifest 路径解析为 `plugins/speccode/.claude-plugin/plugin.json`(相对脚本文件上溯两级),且页脚品牌条不含 `<img>` 远程图片引用

#### Scenario: visual companion 页脚渲染真实版本
- **WHEN** 启动 visual-companion server 并请求其等待页(需先带 ?key= 取 cookie、再携 cookie 请求;直接 curl ?key= 只会得到 bootstrap 跳转页)
- **THEN** 页脚含 `speccode v` + 当前 plugin.json 的 version 值(非 `unknown`),链接指向 plugin.json 的 homepage,页面 HTML 不含任何第三方远程资源 URL
