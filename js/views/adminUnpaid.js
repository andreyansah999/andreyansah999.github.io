import { renderUnpaidShared } from './unpaidShared.js';

export function renderAdminUnpaid(container) {
  return renderUnpaidShared(container, {
    listAction: 'admin.customers.list',
    wifiSetAction: 'admin.wifi.set',
    recordAction: 'admin.payments.record',
    showBranch: false
  });
}
