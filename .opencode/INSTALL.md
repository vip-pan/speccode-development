# Installing speccode for OpenCode

> 待验证:OpenCode 的 plugin / skills 机制随版本演进,以下步骤以探索期实测信息为准,请对照官方文档核对。

## 安装

1. 让 OpenCode 直接安装本仓库(插件根 = 仓库根):

   在项目或全局 `opencode.json` 的 `plugin` 数组加入:

   ```json
   {
     "plugin": ["speccode@git+https://github.com/vip-pan/speccode.git"]
   }
   ```

   重启 OpenCode。(安装机制待验证——OpenCode 通过插件管理器注册 skills。)

2. 安装引擎 shim(让 `speccode <verb>` 进入 PATH):

   ```bash
   bash scripts/install-shim.sh
   ```

3. 工具映射与注意事项见 [`references/host-mapping/opencode.md`](../references/host-mapping/opencode.md)。

## 验证

安装后运行 `speccode plugin-root --cwd .`,应输出本插件根的绝对路径。
