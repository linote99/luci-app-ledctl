'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

var callStatus = rpc.declare({
	object: 'ledctl', method: 'status'
});
var callSetAll = rpc.declare({
	object: 'ledctl', method: 'set_all', params: [ 'enable' ]
});
var callSetGroup = rpc.declare({
	object: 'ledctl', method: 'set_group', params: [ 'group', 'enable' ]
});
var callSetBrightness = rpc.declare({
	object: 'ledctl', method: 'set_brightness', params: [ 'group', 'value' ]
});
var callSetTimeout = rpc.declare({
	object: 'ledctl', method: 'set_timeout', params: [ 'value' ]
});
var callResetBrightness = rpc.declare({ object: 'ledctl', method: 'reset_brightness' });
var callWake = rpc.declare({ object: 'ledctl', method: 'wake' });
var callSleep = rpc.declare({ object: 'ledctl', method: 'sleep' });
var callSetPowerLink = rpc.declare({
	object: 'ledctl', method: 'set_power_link', params: [ 'enable' ]
});

var STATE_TEXT = {
	'online-5g': '已联网 (5G)',
	'online-4g': '已联网 (4G)',
	'offline':   '无数据连接',
	'boot':      '启动中',
	'thermal':   '过热告警',
	'unknown':   '未知'
};

return view.extend({
	load: function() {
		return callStatus();
	},

	render: function(st) {
		this.st = st || {};
		var self = this;

		var s = this.st;
		var allOff = !!s.all_off;

		/* ---------- 总开关 ---------- */
		var masterBtn = E('button', {
			'class': 'btn cbi-button ' + (allOff ? 'cbi-button-apply' : 'cbi-button-reset'),
			'click': ui.createHandlerFn(self, function() {
				return self.doSetAll(allOff ? 1 : 0);
			})
		}, [ allOff ? '全部开启' : '全部关闭' ]);

		var master = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ 'LED 总开关' ]),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-title' }, [ '当前状态' ]),
				E('div', { 'class': 'cbi-value-field' }, [
					E('strong', { 'style': 'color:' + (allOff ? '#c00' : '#080') },
						[ allOff ? '全部关闭' : '正常显示' ])
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-title' }, [ '厂商网络状态' ]),
				E('div', { 'class': 'cbi-value-field' },
					[ STATE_TEXT[s.state] || s.state || '未知' ])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-title' }, [ '操作' ]),
				E('div', { 'class': 'cbi-value-field' }, [ masterBtn ])
			])
		]);

		/* ---------- 分组开关 ---------- */
		function groupRow(title, desc, key, enabled) {
			var cb = E('input', {
				'type': 'checkbox',
				'checked': enabled ? '' : null,
				'change': ui.createHandlerFn(self, function(ev) {
					return self.doSetGroup(key, ev.target.checked ? 1 : 0);
				})
			});
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ title, cb ]),
				E('div', { 'class': 'cbi-value-field' }, [
					E('span', { 'class': 'cbi-value-description' }, [ desc ])
				])
			]);
		}

		var groups = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ '分组开关' ]),
			groupRow('信号灯', '4G 蓝 / 5G 白 / 无服务红', 'signal', s.signal),
			groupRow('WiFi 灯', '2.4G 与 5G 热点指示', 'wifi', s.wifi),
			groupRow('电源灯', '开机白光 / 充电指示', 'battery', s.battery)
		]);

		/* ---------- 电源联动 ---------- */
		var plCb = E('input', {
			'type': 'checkbox',
			'checked': s.power_link ? '' : null
		});

		var plBtn = E('button', {
			'class': 'btn cbi-button cbi-button-apply',
			'click': ui.createHandlerFn(self, function() {
				return self.doSetPowerLink(plCb.checked ? 1 : 0);
			})
		}, [ '保存并应用' ]);

		var powerLink = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ '电源联动' ]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ '接入电源时关闭 LED' ]),
				E('div', { 'class': 'cbi-value-field' }, [ plCb ])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-title' }, [ '当前电源' ]),
				E('div', { 'class': 'cbi-value-field' }, [
					E('strong', { 'style': 'color:' + (s.on_power ? '#c80' : '#888') },
						[ s.on_power ? '已接入电源' : '电池供电' ])
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-title' }, [ '监听脚本' ]),
				E('div', { 'class': 'cbi-value-field' }, [
					s.hook_installed ? '已安装' : '未安装'
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-title' }, [ '操作' ]),
				E('div', { 'class': 'cbi-value-field' }, [
					plBtn,
					E('div', { 'class': 'cbi-value-description' },
						[ '勾选后点「保存并应用」才会生效。' ])
				])
			])
		]);

		/* ---------- 超时 ---------- */
		var toInput = E('input', {
			'type': 'text', 'class': 'cbi-input-text',
			'style': 'width:6em', 'value': '' + (s.timeout ?? 15)
		});
		var timeoutSec = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ '自动熄灭' ]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ '熄灭延时（秒）' ]),
				E('div', { 'class': 'cbi-value-field' }, [
					toInput,
					E('button', {
						'class': 'btn cbi-button cbi-button-save',
						'style': 'margin-left:6px',
						'click': ui.createHandlerFn(self, function() {
							return self.doSetTimeout(toInput.value);
						})
					}, [ '保存' ]),
					E('div', { 'class': 'cbi-value-description' },
						[ '0 = 常亮不灭；默认 15 秒。设备有电源键可唤醒。' ])
				])
			])
		]);

		/* ---------- 亮度 ---------- */
		function briRow(title, key, val) {
			var inp = E('input', {
				'type': 'range', 'min': '0', 'max': '255',
				'value': '' + (val ?? 255), 'style': 'width:14em'
			});
			var lbl = E('span', { 'style': 'margin-left:6px' }, [ '' + (val ?? 255) ]);
			inp.addEventListener('input', function() { lbl.textContent = inp.value; });
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ title ]),
				E('div', { 'class': 'cbi-value-field' }, [
					inp, lbl,
					E('button', {
						'class': 'btn cbi-button cbi-button-save',
						'style': 'margin-left:6px',
						'click': ui.createHandlerFn(self, function() {
							return self.doSetBrightness(key, inp.value);
						})
					}, [ '应用' ])
				])
			]);
		}

		var bri = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ '亮度' ]),
			briRow('信号灯亮度', 'signal', s.signal_brightness),
			briRow('WiFi 灯亮度', 'wifi', s.wifi_brightness),
			briRow('电源灯亮度', 'battery', s.battery_brightness),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-title' }, [ '恢复默认' ]),
				E('div', { 'class': 'cbi-value-field' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-reset',
						'click': ui.createHandlerFn(self, function() {
							return self.doResetBrightness();
						})
					}, [ '恢复默认亮度' ]),
					E('div', { 'class': 'cbi-value-description' },
						[ '信号灯 255 / WiFi 灯 127 / 电源灯 255' ])
				])
			])
		]);

		/* ---------- 临时操作 ---------- */
		var actions = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ '临时操作' ]),
			E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-title' }, [ '立即唤醒' ]),
				E('div', { 'class': 'cbi-value-field' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(self, function() {
							return callWake().then(function() {
								ui.addNotification(null, E('p', {}, [ '已唤醒，按设定延时后自动熄灭' ]), 'info');
								return self.refresh();
							});
						})
					}, [ '点亮' ]),
					E('button', {
						'class': 'btn cbi-button cbi-button-reset',
						'style': 'margin-left:6px',
						'click': ui.createHandlerFn(self, function() {
							return callSleep().then(function() {
								ui.addNotification(null, E('p', {}, [ '已熄灭' ]), 'info');
								return self.refresh();
							});
						})
					}, [ '熄灭' ]),
					E('div', { 'class': 'cbi-value-description' },
						[ '只影响当前，不改配置。' ])
				])
			])
		]);

		/* ---------- 灯位实测 ---------- */
		var ledRows = [];
		var LED_DESC = {
			'sc27xx:green': '电源灯（实际白光）',
			'sc27xx:red': '无服务 / 过热告警（红）',
			'sc27xx:blue': '4G 数据（蓝）',
			'zte-ldo0': '5G 数据（白）',
			'zte-ldo1': 'WiFi 5GHz',
			'zte-ldo2': 'WiFi 2.4GHz',
			'keyboard-backlight': '无服务指示（红）'
		};
		for (var k in (s.leds || {})) {
			ledRows.push(E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-title' }, [ k ]),
				E('div', { 'class': 'cbi-value-field' }, [
					LED_DESC[k] || '',
					E('span', { 'style': 'margin-left:8px;color:#888' },
						[ '亮度 ' + s.leds[k] ])
				])
			]));
		}

		var diag = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ '灯位对照（实测）' ])
		].concat(ledRows));

		this.root = E('div', {}, [
			E('h2', {}, [ 'LED 控制' ]),
			E('div', { 'class': 'cbi-map-descr' },
				[ 'U30 Air 的 LED 由厂商 mu300-led 管理，本页读写 system.mu300_leds 配置。' ]),
			master, groups, powerLink, timeoutSec, bri, actions, diag
		]);
		return this.root;
	},

	/* ---------- 动作 ---------- */
	doSetAll: function(enable) {
		return callSetAll(enable).then(function(r) {
			if (!r || r.ok != 1) {
				ui.addNotification(null, E('p', {},
					[ '操作失败：' + JSON.stringify(r || '无响应') ]), 'error');
				return;
			}
			ui.addNotification(null, E('p', {},
				[ enable == 1 ? '已全部开启' : '已全部关闭' ]), 'info');
			return this.refresh();
		}.bind(this));
	},

	doSetGroup: function(group, enable) {
		return callSetGroup(group, enable).then(function(r) {
			if (!r || r.ok != 1) {
				ui.addNotification(null, E('p', {}, [ '操作失败' ]), 'error');
				return;
			}
			return this.refresh();
		}.bind(this));
	},

	doSetBrightness: function(group, value) {
		return callSetBrightness(group, parseInt(value, 10) || 0).then(function(r) {
			if (!r || r.ok != 1) {
				ui.addNotification(null, E('p', {}, [ '设置失败' ]), 'error');
				return;
			}
			ui.addNotification(null, E('p', {}, [ '亮度已更新' ]), 'info');
			return this.refresh();
		}.bind(this));
	},

	doResetBrightness: function() {
		return callResetBrightness().then(function(r) {
			if (!r || r.ok != 1) {
				ui.addNotification(null, E('p', {}, [ '恢复失败' ]), 'error');
				return;
			}
			ui.addNotification(null, E('p', {}, [ '亮度已恢复默认' ]), 'info');
			return this.refresh();
		}.bind(this));
	},

	doSetTimeout: function(value) {
		return callSetTimeout(parseInt(value, 10) || 0).then(function(r) {
			if (!r || r.ok != 1) {
				ui.addNotification(null, E('p', {}, [ '设置失败（0-86400）' ]), 'error');
				return;
			}
			ui.addNotification(null, E('p', {}, [ '熄灭延时已设为 ' + value + ' 秒' ]), 'info');
			return this.refresh();
		}.bind(this));
	},

	doSetPowerLink: function(enable) {
		return callSetPowerLink(enable).then(function(r) {
			if (!r || r.ok != 1) {
				ui.addNotification(null, E('p', {}, [ '设置失败' ]), 'error');
				return;
			}
			ui.addNotification(null, E('p', {},
				[ enable == 1 ? '电源联动已开启' : '电源联动已关闭' ]), 'info');
			return this.refresh();
		}.bind(this));
	},

	refresh: function() {
		var self = this;
		return callStatus().then(function(st) {
			self.st = st || {};
			if (self.root && self.root.parentNode) {
				var fresh = self.render(self.st);
				self.root.parentNode.replaceChild(fresh, self.root);
				self.root = fresh;
			}
			return st;
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
