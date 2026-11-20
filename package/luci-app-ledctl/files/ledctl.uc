#!/usr/bin/ucode
'use strict';

// LED 总开关后端：读写 system.mu300_leds 与 system.@system[-1].leds_off，
// 并调用厂商的 mu300-led / led-status 立即应用。

import { popen, readfile, writefile } from 'fs';

const LED_BIN  = '/opt/mu300/bin/mu300-led';
const STAT_BIN = '/opt/mu300/bin/led-status';
const CONF     = '/etc/mu300/led.conf';
const HOTPLUG  = '/etc/hotplug.d/power_supply/99-ledctl-power';
const POWER_CHARGER = '/sys/class/power_supply/bq256xx-charger/online';
const POWER_FGU     = '/sys/class/power_supply/sc27xx-fgu/status';

function run(cmd) {
	let p = popen(cmd + ' 2>/dev/null', 'r');
	if (p == null) return '';
	let out = p.read('all') ?? '';
	p.close();
	return trim(out);
}

function rc(cmd) {
	let p = popen(cmd + ' >/dev/null 2>&1', 'r');
	if (p == null) return 1;
	p.read('all');
	let r = p.close();
	return (r == null) ? 1 : r;
}

function uci_get(key, def) {
	let v = run('uci -q get ' + key);
	return (v == null || v === '') ? def : v;
}

function int_or(v, def) {
	if (v == null || v === '') return def;
	let n = +v;
	if (n != n) return def;      // NaN 自比较
	if (n < 0) return def;
	return n;
}

// ---- 电源检测 ----
function is_on_power() {
	let v = run('cat ' + POWER_CHARGER);
	if (v != null && v !== '') return v == '1';
	let st = run('cat ' + POWER_FGU);
	return (st == 'Charging' || st == 'Full');
}

// ---- 状态读取 ----
function read_state() {
	let signal  = uci_get('system.mu300_leds.signal',  '1') != '0';
	let wifi    = uci_get('system.mu300_leds.wifi',    '1') != '0';
	let battery = uci_get('system.mu300_leds.battery', '1') != '0';

	let timeout = int_or(uci_get('system.mu300_leds.timeout'), 15);
	let sBri    = int_or(uci_get('system.mu300_leds.signal_brightness'), 255);
	let wBri    = int_or(uci_get('system.mu300_leds.wifi_brightness'), 127);
	let bBri    = int_or(uci_get('system.mu300_leds.battery_brightness'), 255);

	// 当前厂商状态：online-5g / online-4g / offline / boot / thermal
	let cur = run('cat /run/led-status.state');
	if (cur === '') cur = 'unknown';

	// 每颗灯的真实亮度，用于界面回显
	let names = [ 'sc27xx:green', 'sc27xx:red', 'sc27xx:blue',
	              'zte-ldo0', 'zte-ldo1', 'zte-ldo2', 'keyboard-backlight' ];
	let leds = {};
	for (let i = 0; i < length(names); i++) {
		let name = names[i];
		let b = run('cat /sys/class/leds/' + name + '/brightness');
		leds[name] = int_or(b, 0);
	}

	let ledsOff = uci_get('system.@system[-1].leds_off', '0') == '1';

	// 是否装了厂商 LED 工具
	let has_vendor = rc('[ -x ' + LED_BIN + ' ]') == 0;

	// 电源联动
	let power_link = uci_get('system.mu300_leds.power_link', '0') == '1';
	let on_power   = is_on_power();
	let hook_on    = rc('[ -x ' + HOTPLUG + ' ]') == 0;

	return {
		signal: signal, wifi: wifi, battery: battery,
		timeout: timeout,
		signal_brightness: sBri,
		wifi_brightness: wBri,
		battery_brightness: bBri,
		state: cur,
		leds: leds,
		leds_off: ledsOff,
		has_vendor: has_vendor,
		power_link: power_link,
		on_power: on_power,
		hook_installed: hook_on,
		// 全部关闭 = 三组都关
		all_off: (!signal && !wifi && !battery)
	};
}

// ---- 写入 ----
function set_uci(kv) {
	let cmds = [];
	for (let k in kv)
		cmds[length(cmds)] = 'uci set system.mu300_leds.' + k + "='" + kv[k] + "'";
	cmds[length(cmds)] = 'uci commit system';
	return rc(join(' && ', cmds)) == 0;
}

// 立即应用：唤醒 → 刷新状态
function apply_now() {
	run(LED_BIN + ' wake');
	run(STAT_BIN + ' refresh');
	return true;
}

let HOOK_BODY = [
	'#!/bin/sh\n',
	'# luci-app-ledctl 电源联动\n',
	'# 插电 -> 全灭；拔电 -> 恢复厂商默认（signal/wifi/battery = 1）\n',
	'[ -z "$ACTION" ] || [ "$ACTION" = add ] || [ "$ACTION" = change ] || [ "$ACTION" = remove ] || exit 0\n',
	'[ "$(uci -q get system.mu300_leds.power_link)" = 1 ] || exit 0\n',
	'[ -x /opt/mu300/bin/mu300-led ] || exit 0\n',
	'\n',
	'STATE=/run/ledctl-power.state\n',
	'\n',
	'online=0\n',
	'if [ -r /sys/class/power_supply/bq256xx-charger/online ]; then\n',
	'\t[ "$(cat /sys/class/power_supply/bq256xx-charger/online)" = 1 ] && online=1\n',
	'else\n',
	'\tcase "$(cat /sys/class/power_supply/sc27xx-fgu/status 2>/dev/null)" in\n',
	'\t\tCharging|Full) online=1 ;;\n',
	'\tesac\n',
	'fi\n',
	'\n',
	'# 防抖：状态没变就不写 flash\n',
	'[ "$(cat "$STATE" 2>/dev/null)" = "$online" ] && exit 0\n',
	'echo "$online" > "$STATE"\n',
	'\n',
	'if [ "$online" = 1 ]; then\n',
	'\tuci -q set system.mu300_leds.signal=0\n',
	'\tuci -q set system.mu300_leds.wifi=0\n',
	'\tuci -q set system.mu300_leds.battery=0\n',
	'else\n',
	'\tuci -q set system.mu300_leds.signal=1\n',
	'\tuci -q set system.mu300_leds.wifi=1\n',
	'\tuci -q set system.mu300_leds.battery=1\n',
	'fi\n',
	'uci -q commit system\n',
	'/opt/mu300/bin/mu300-led wake\n',
	'/opt/mu300/bin/led-status refresh 2>/dev/null\n',
	'exit 0\n',
	'\n'
];
HOOK_BODY = join('', HOOK_BODY);

const methods = {};

methods.status = {
	call: function() {
		return read_state();
	}
};

// 总开关：all=on 恢复三组，all=off 全灭
methods.set_all = {
	args: { enable: 0 },
	call: function(req) {
		let on = (req.args.enable == 1 || req.args.enable == '1');
		let v = on ? '1' : '0';
		let ok = set_uci({ signal: v, wifi: v, battery: v });
		if (ok) apply_now();
		return { ok: ok ? 1 : 0, all_off: !on };
	}
};

// 分组开关
methods.set_group = {
	args: { group: '', enable: 0 },
	call: function(req) {
		let g = req.args.group;
		if (g != 'signal' && g != 'wifi' && g != 'battery')
			return { ok: 0, error: 'bad group' };
		let on = (req.args.enable == 1 || req.args.enable == '1');
		let kv = {};
		kv[g] = on ? '1' : '0';
		let ok = set_uci(kv);
		if (ok) apply_now();
		return { ok: ok ? 1 : 0 };
	}
};

// 亮度
methods.set_brightness = {
	args: { group: '', value: 0 },
	call: function(req) {
		let g = req.args.group;
		if (g != 'signal' && g != 'wifi' && g != 'battery')
			return { ok: 0, error: 'bad group' };
		let v = int_or(req.args.value, -1);
		if (v < 0 || v > 255) return { ok: 0, error: 'out of range' };
		let kv = {};
		kv[g + '_brightness'] = '' + v;
		let ok = set_uci(kv);
		if (ok) apply_now();
		return { ok: ok ? 1 : 0 };
	}
};

// 自动熄灭超时（秒，0=常亮）
methods.set_timeout = {
	args: { value: 0 },
	call: function(req) {
		let v = int_or(req.args.value, -1);
		if (v < 0 || v > 86400) return { ok: 0, error: 'out of range' };
		let ok = rc("uci set system.mu300_leds.timeout='" + v + "' && uci commit system") == 0;
		if (ok) apply_now();
		return { ok: ok ? 1 : 0, timeout: v };
	}
};

// 临时唤醒（按厂商逻辑亮 timeout 秒）
methods.wake = {
	call: function() {
		let has = rc('[ -x ' + LED_BIN + ' ]') == 0;
		if (has) run(LED_BIN + ' wake');
		return { ok: has ? 1 : 0 };
	}
};

// 立即熄灭（不动配置，只是让厂商进入 dark）
methods.sleep = {
	call: function() {
		let has = rc('[ -x ' + LED_BIN + ' ]') == 0;
		if (has) run(LED_BIN + ' sleep');
		return { ok: has ? 1 : 0 };
	}
};

// 电源联动开关
methods.set_power_link = {
	args: { enable: 0 },
	call: function(req) {
		let on = (req.args.enable == 1 || req.args.enable == '1');
		let ok = rc("uci set system.mu300_leds.power_link='" + (on ? '1' : '0') + "' && uci commit system") == 0;

		if (on) {
			// 安装热插拔脚本
			run('mkdir -p /etc/hotplug.d/power_supply');
			let w = writefile(HOTPLUG + '.tmp', HOOK_BODY);
			if (w) run('mv ' + HOTPLUG + '.tmp ' + HOTPLUG);
			run('chmod 755 ' + HOTPLUG);
			// 立即按当前电源状态应用一次
			run(HOTPLUG);
		} else {
			run('rm -f ' + HOTPLUG);
		}

		return { ok: ok ? 1 : 0, power_link: on, on_power: is_on_power() };
	}
};

// 恢复默认亮度：signal 255 / wifi 127 / battery 255
methods.reset_brightness = {
	call: function() {
		let ok = set_uci({
			signal_brightness: '255',
			wifi_brightness: '127',
			battery_brightness: '255'
		});
		if (ok) apply_now();
		return {
			ok: ok ? 1 : 0,
			signal_brightness: 255,
			wifi_brightness: 127,
			battery_brightness: 255
		};
	}
};

return { 'ledctl': methods };
