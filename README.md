# luci-app-ledctl

面向中兴 ZTE U30 Air / MU300 系列 OpenWrt 固件的 LuCI LED 控制插件。它通过 LuCI 页面管理设备的 LED 配置，不是 Android APK。

## 功能

- 总开关：一键点亮或熄灭所有 LED。
- 分组开关：分别控制信号灯、Wi-Fi 灯和电源灯。
- 亮度：三组独立调整，范围 0–255，支持恢复默认值（255/127/255）。
- 自动熄灭：可设置延时；0 表示常亮，默认 15 秒。
- 临时点亮 / 熄灭：立即操作，不修改保存的设置。
- 电源联动：开启后，接入电源时熄灭 LED，拔掉电源时将各组设为开启。
- LuCI 菜单：系统 → LED 控制。

拔掉电源时当前实现会开启所有 LED 组，不会恢复插电前各组原来的开关状态。

## 适用范围

项目说明标注已在 OpenWrt 25.12.5、armsr/armv8 上测试。此插件依赖设备固件提供的厂商 LED 管理程序 `/opt/mu300/bin/mu300-led`，以及相应的 `power_supply` 状态节点。它不是通用路由器 LED 插件；不同定制固件请先确认相关路径与依赖。

APK 使用 OpenWrt 25.12.5 SDK 构建，包架构为 `noarch`，运行时依赖为 `luci-base`、`rpcd` 和 `ucode`。安装前应确认设备已安装 LuCI/rpcd/ucode 组件。

## 安装 APK

将 `luci-app-ledctl-1.0.0-r1.apk` 上传到路由器后执行：

```sh
apk add --allow-untrusted /tmp/luci-app-ledctl-1.0.0-r1.apk
```

这是未签名的本地构建包，使用 `--allow-untrusted` 是 OpenWrt 对本地 APK 的标准安装方式。若设备的依赖不在本地已安装软件中，请先确保已配置对应版本的 OpenWrt 软件源。

安装后进入 LuCI 的“系统 → LED 控制”。卸载命令：

```sh
apk del luci-app-ledctl
```

卸载时会清理插件创建的电源热插拔脚本并刷新 RPC/LuCI 状态；`system.mu300_leds` 配置保留。

## 从 OpenWrt SDK 构建

将本仓库的 `package/luci-app-ledctl` 目录放入相同版本的 OpenWrt SDK，然后运行：

```sh
make defconfig
make package/luci-app-ledctl/compile CONFIG_PACKAGE_luci-app-ledctl=m V=s
```

生成文件位于 `bin/packages/` 下。

## 安装文件

- `/usr/share/rpcd/ucode/ledctl.uc`
- `/usr/share/luci/menu.d/luci-app-ledctl.json`
- `/usr/share/rpcd/acl.d/luci-app-ledctl.json`
- `/www/luci-static/resources/view/ledctl.js`

启用电源联动后由后端按需创建 `/etc/hotplug.d/power_supply/99-ledctl-power`；关闭联动或卸载插件时会移除。
