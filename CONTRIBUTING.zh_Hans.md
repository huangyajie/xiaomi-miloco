# 贡献指南

<div align="center">

简体中文 | [English](CONTRIBUTING.md)

</div>

感谢您考虑为我们的项目做出贡献！您的努力将使我们的项目变得更好。

在您开始贡献之前，请花一点时间阅读以下准则：

## 我可以如何贡献？

### 报告问题

如果您在这个 fork 中遇到错误，请在 GitHub 上[报告问题](https://github.com/xyiqq/xiaomi-miloco/issues/new/)，并提供关于错误的详细信息，包括复现步骤、 debug 级日志以及错误出现的时间。

- 打开 debug 日志方法
  - 主服务：

    主服务配置配置文件在 `config/server_config.yaml` 中。如果使用docker部署，配置文件会放在宿主机启动docker的同级目录下，子目录为 `./config/server_config.yaml`
    ```yaml
    # 修改 config 文件配置
    server:
      log_level: "debug"
    ```
  - 推理服务：

    推理服务配置配置文件在 `config/ai_engine_config.yaml` 中。如果使用docker部署，配置文件会放在宿主机启动docker的同级目录下，子目录为 `./config/ai_engine_config.yaml`
    ```yaml
    # 修改 config 文件配置
    server:
      log_level: "debug"
    ```

- 日志保存路径如下：
  - 源代码启动时，日志文件在项目根目录 `./log/` 目录中
  - docker 启动时，日志文件挂载在宿主机 docker 启动的同级目录下，子目录为 `./log/`

  请上传整个日志目录。


### 贡献代码

1. Fork 该仓库，并基于 `main` 分支最新代码开发。
2. 完成代码修改，确保您的代码符合项目的编码规范。
3. 提交合并请求 (push request) 至主仓。

## 合并请求准则

在合并请求之前，请确保满足以下要求：

- 您的合并请求解决了单个问题或功能。
- 您已在本地测试过您的更改。
- 您的代码遵循项目的代码规范
  - python: 已运行 [`pylint`](https://github.com/google/pyink) 搭配本项目的 [pylintrc](.pylintrc) 检查代码。
  - c/cpp: 已运行 [`clang-format`](https://clang.llvm.org/docs/ClangFormat.html) 搭配本项目[clang-format](.clang-format) 检查代码。
  - js: 已运行 [`eslint`](https://github.com/eslint/eslint) 搭配本项目的 [.eslintrc](web_ui/eslint.config.js) 检查代码。
- 您的合并请求应包含清晰的描述和相关的上下文信息。
- 所有现有测试都通过，如有必要，请添加修改代码对应的测试。
- 任何依赖更改都有文档说明。

## Commit Message 格式

```
<type>: <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

type ：有以下几种变更类型

- feat：新增功能。
- fix：修复问题。
- docs：仅仅修改了文档。
- style：仅仅是对格式进行修改，如逗号、缩进、空格等，不改变代码逻辑。
- refactor：代码重构，没有新增功能或修复问题。
- perf：优化性能。
- test：增加或修改测试用例。
- chore：修改编译流程，或变更依赖库和工具等。
- revert：版本回滚。

subject：简洁的标题，描述本次提交的概要。使用祈使句、现在时态，首字母小写，结尾不加句号。

body：描述本次提交的详细内容，解释为什么需要这些变更。除 docs 之外的变更类型必须包含 body。

footer：（可选）关联的 issue。

## 命名规范

### 米家命名规范

- 描述“小米”时必须使用“Xiaomi”，变量名称可以使用“xiaomi”或“mi”。
- 描述“米家”时必须使用“Xiaomi Home”，变量名称可以使用“mihome”或“MiHome”。
- 描述“小米IoT”时必须使用“MIoT”，变量名称可以使用“miot”或“MIoT”。

### 第三方平台命名规范

- 描述“Home Assistant”时必须使用“Home Assistant”，变量可以使用“hass”或“hass_xxx”。

### 其它命名规范

- 文档中的中文语句包含英文时，如果英文没有被中文引号括起来，那么中文与英文之间必须有一个空格。（最好代码注释也这么写）
