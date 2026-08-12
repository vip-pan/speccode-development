# tasks: readme-english

## 根 README 双语化

- [ ] `git mv` 根 `README.md` → `README_CN.md`;顶部加语言切换链接(指向新英文版)
- [ ] 新建根 `README.md`:英文全量翻译(12 段骨架一一对应,专名保留原文)+ 顶部 toggle 链接回 `README_CN.md`;badges 保留

## 插件 README 双语化

- [ ] `git mv` `plugins/speccode/README.md` → `plugins/speccode/README_CN.md`;顶部加语言切换链接
- [ ] 新建 `plugins/speccode/README.md`:英文全量翻译(260 行,节号 §1-14 与中文版一致,门面指针→根 `README.md`,toggle→`README_CN.md`)
- [ ] `plugins/speccode/README_CN.md` 门面指针改指根 `README_CN.md`(原指根 README)

## CLAUDE.md 增补

- [ ] 「文档分工」更新为四 README 文件映射(根 EN/CN + 插件 EN/CN)
- [ ] 新增「多语言维护」说明:双倍维护面纪律、结构对齐(12 段骨架/节号为锚)、翻译改动必须同步全部语言版本

## 规格同步

- [ ] spec delta 已就位(changes/readme-english/propose/specs/plugin-packaging/spec.md)
- [ ] syncing 将 delta 合并入 speccode/spec/plugin-packaging/spec.md

## 验证

- [ ] 全量测试回归:`node --test ./plugins/speccode/tests/*.test.mjs` 137/137
- [ ] 互链矩阵 4 组链接逐链有效(根 EN↔CN、插件 EN↔CN、根→插件同语言、插件指针→同语言根)
- [ ] 根两版段落结构一致(12 段);插件两版节号一致(§1-14)
- [ ] 根两版均无版本号字面量;CLAUDE.md 无「137」字面量
- [ ] 英文版无残留中文段落(代码块与专名除外)
