# 独立资源与远程分发

海奇AI官网的 `site/catalogs/*.json` 是五类精选展示数据的唯一维护位置。本仓库不新建精选清单；旧 `catalog.json` 仅继续服务现有插件目录契约。

| 目录 | 内容 |
| --- | --- |
| `addons/<slug>/` | 自建 Add-on，保留已有发布路径 |
| `pi-extensions/<slug>/` | Pi 扩展或完整能力包 |
| `skills/<slug>/` | SKILL.md 及全部附属资料、许可和来源 |
| `mcps/<slug>/` | MCP 配置模板与配置说明，不存凭据 |
| `employees/<storage_slug>/` | 员工身份、头像、岗位指令和专属能力 |
| `connectors/<slug>/` | 可独立安装的连接器适配器 |

新分类资源以 `resource.json` 声明类型、身份和版本。`python3 scripts/pack-resources.py` 生成 `docs/packages/haiqiai-<类型>-<身份>-<版本>.tgz`，输出字节数和 SHA-256，供官网精选引用。员工头像同时输出到 `docs/packages/haiqiai-employees-<身份>-<版本>-avatar.jpg`，供精选安装前展示；同样禁止覆盖同版本内容。此输出是构建收据，不是另一份精选数据。旧 Add-on 继续保留原打包路径；参与新版精选的 Add-on 另提供 resource.json，由确定性打包器生成带 haiqiai-addons 前缀的包，排除测试与截图。

包必须自包含，不依赖海奇源码或维护者的正式 Store。员工不得携带个人记忆、会话、凭据或本地批准记录。第三方资源保留许可、上游固定版本和适配差异。资源包不随海奇安装包分发，用户点击安装时远程下载并校验。

GitHub Pages 继续提供无需注册表认证的公开 tarball；不使用 GitHub Packages。每次改变包内容递增版本，同版本包不可覆盖。先完成真实安装使用验收，再发布资源，最后更新官网精选。发布工作流已接入新分类打包与校验；部署时从 gh-pages 恢复既有带版本资源，逐字校验并保留历史公开地址，旧目录仍按当前维护范围重新构建。

自动检查：`python3 -m unittest discover -s scripts -p test_pack_resources.py`。通过打包和自动检查不代表桌面实际安装使用通过。
