import { renderUnpaidShared } from './unpaidShared.js';

export function renderOwnerUnpaid(container) {
  return renderUnpaidShared(container, {
    listAction: 'owner.customers.list',
    wifiSetAction: 'owner.wifi.set',
    recordAction: 'owner.payments.record',
    showBranch: true
  });
}
