import { renderWifiShared } from './wifiShared.js';

export function renderOwnerWifi(container) {
  return renderWifiShared(container, {
    monitorAction: 'owner.wifi.monitor',
    setAction: 'owner.wifi.set',
    showBranch: true
  });
}
