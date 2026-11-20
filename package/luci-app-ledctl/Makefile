include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-ledctl
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=Lino

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-ledctl
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LED control for ZTE U30 Air / MU300
  DEPENDS:=+luci-base +rpcd +ucode
  PKGARCH:=all
endef

define Package/luci-app-ledctl/description
A LuCI interface for controlling LED groups, brightness, timeout and power-linked LED behavior on ZTE U30 Air / MU300-series OpenWrt firmware.
endef

define Build/Compile
endef

define Package/luci-app-ledctl/install
	$(INSTALL_DIR) $(1)/usr/share/rpcd/ucode
	$(INSTALL_BIN) $(TOPDIR)/package/luci-app-ledctl/files/ledctl.uc $(1)/usr/share/rpcd/ucode/ledctl.uc
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) $(TOPDIR)/package/luci-app-ledctl/files/luci-app-ledctl.json $(1)/usr/share/luci/menu.d/luci-app-ledctl.json
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) $(TOPDIR)/package/luci-app-ledctl/files/acl-ledctl.json $(1)/usr/share/rpcd/acl.d/luci-app-ledctl.json
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view
	$(INSTALL_DATA) $(TOPDIR)/package/luci-app-ledctl/files/led.js $(1)/www/luci-static/resources/view/ledctl.js
endef

define Package/luci-app-ledctl/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
rm -f /tmp/luci-indexcache*.json
/etc/init.d/rpcd restart
exit 0
endef

define Package/luci-app-ledctl/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
rm -f /etc/hotplug.d/power_supply/99-ledctl-power
rm -f /tmp/luci-indexcache*.json
/etc/init.d/rpcd restart
exit 0
endef

$(eval $(call BuildPackage,luci-app-ledctl))
