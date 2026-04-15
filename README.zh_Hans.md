# Xiaomi Miloco (大傻 Fork)

这是一个面向自托管部署的 Xiaomi Miloco fork。

这个仓库保留了上游 Xiaomi Miloco 的基础能力，但把这个 fork 本身作为
当前维护的部署入口。如果你需要这里已经整理好的 Home Assistant、RTSP
和设备管理界面增强能力，请直接从这个仓库部署，不要再按上游原仓库部署。

<div align="center">

简体中文 | [English](README.md)

</div>

## 为什么用这个 fork

- 面向自托管场景整理了更稳定的 Home Assistant 设备管理能力。
- 支持第三方 RTSP 摄像头新增、编辑、删除和配置持久化。
- 设备管理支持隐藏、恢复、搜索、按区域分组和批量操作。
- 摄像头界面支持更实用的 RTSP 内联管理和 16:9 全屏显示。
- 仓库内已经包含公开可发布的部署说明，可直接作为部署源使用，而不是聊天里的临时补丁集合。

## 当前版本

- 当前 fork release：[`v0.0.5-fork`](https://github.com/xyiqq/xiaomi-miloco/releases/tag/v0.0.5-fork)
- 更新日志：[CHANGELOG.zh_Hans.md](CHANGELOG.zh_Hans.md)
- 部署说明：[docs/deployment/README.md](docs/deployment/README.md)

## 快速部署

```bash
git clone https://github.com/xyiqq/xiaomi-miloco.git
cd xiaomi-miloco
bash scripts/install.sh
```

如果是自托管部署，建议先读这几份文档：

1. [docs/deployment/README.md](docs/deployment/README.md)
2. [docs/deployment/fork-customizations_zh-Hans.md](docs/deployment/fork-customizations_zh-Hans.md)
3. [docs/environment-setup_zh-Hans.md](docs/environment-setup_zh-Hans.md)

## Fork 主要增强

### Home Assistant

- 设备列表与分组能力
- 设备管理页面的区域信息修复
- 已隐藏设备与恢复流程
- 设备控制时 `service_data` 正确透传

### RTSP 摄像头

- 支持 RTSP 摄像头新增、编辑、删除、查看
- 支持运行时配置持久化
- 支持从摄像头列表直接管理 RTSP 摄像头
- 编辑时地址留空会沿用原有流地址

### 设备管理界面

- 支持按名称、ID、型号、区域搜索
- 支持按区域或家庭分组
- 支持区域级批量选择
- 支持批量移除和已隐藏设备恢复

### 摄像头界面

- 支持 RTSP 摄像头卡片内联编辑和删除
- 摄像头卡片展示更简洁
- 全屏播放改为保留 16:9 比例，不再强行裁切

## 文档入口

- 部署说明：[docs/deployment/README.md](docs/deployment/README.md)
- Fork 定制说明：[docs/deployment/fork-customizations_zh-Hans.md](docs/deployment/fork-customizations_zh-Hans.md)
- 更新日志：[CHANGELOG.zh_Hans.md](CHANGELOG.zh_Hans.md)
- 使用文档：[docs/usage/README_zh_Hans.md](docs/usage/README_zh_Hans.md)
- 开发文档：[docs/development/developer-setup_zh_Hans.md](docs/development/developer-setup_zh_Hans.md)

## 与上游的关系

这个 fork 基于上游 Xiaomi Miloco 项目，核心理念、主体架构和许可证约束仍然继承自上游。
上游仍然是项目原始来源；这个 fork 的目标是提供一个适合直接部署、并持续维护这些
自托管集成与界面增强能力的分支。

如果你需要查看上游原仓库，可以访问：

- 上游仓库：[XiaoMi/xiaomi-miloco](https://github.com/XiaoMi/xiaomi-miloco)

## 反馈与讨论

- Issues：[大傻/xiaomi-miloco issues](https://github.com/xyiqq/xiaomi-miloco/issues)
- Discussions：[大傻/xiaomi-miloco discussions](https://github.com/xyiqq/xiaomi-miloco/discussions)

## 许可证

许可证请查看 [LICENSE.md](LICENSE.md)。

这个 fork 仍然遵循上游项目的非商业许可证说明。
