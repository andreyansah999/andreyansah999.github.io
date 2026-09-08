import { renderCustomersShared } from './customersShared.js';

export function renderOwnerCustomers(container) {
  return renderCustomersShared(container, {
    listAction: 'owner.customers.list',
    saveAction: 'owner.customers.save',
    deleteAction: 'owner.customers.delete',
    wifiSetAction: 'owner.wifi.set',
    importAction: 'owner.customers.import',
    voidPaymentAction: 'owner.payments.void',
    showBranch: true
  });
}
