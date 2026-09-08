import { renderWifiShared } from './wifiShared.js';

export function renderAdminWifi(container) {
  return renderWifiShared(container, {
    monitorAction: 'admin.wifi.monitor',
    setAction: 'admin.wifi.set',
    showBranch: false
  });
}
