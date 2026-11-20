# luci-app-ledctl v1.0.0

为中兴 ZTE U30 Air / MU300 系列 OpenWrt 固件提供的 LuCI LED 控制插件首个版本。

功能包括总开关、信号灯 / Wi-Fi 灯 / 电源灯分组控制、独立亮度调节、自动熄灭时间、临时点亮 / 熄灭，以及电源状态联动。拔掉电源时，当前实现会将各组设为开启，不会恢复插电前的各组状态。

本 Release 的 APK 使用 OpenWrt 25.12.5 armsr/armv8 SDK 构建，包架构为 `noarch`，未签名；依赖 `luci-base`、`rpcd` 和 `ucode`。插件还依赖设备固件的 `/opt/mu300/bin/mu300-led` 及相应 `power_supply` 节点，非该系列设备或定制固件请先确认兼容性。

把 APK 传到路由器后可执行：

```sh
apk add --allow-untrusted /tmp/luci-app-ledctl-1.0.0-r1.apk
```

安装后从 LuCI 的“系统 → LED 控制”进入。卸载：

```sh
apk del luci-app-ledctl
```
