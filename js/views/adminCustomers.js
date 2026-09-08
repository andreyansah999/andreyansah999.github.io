import { renderCustomersShared } from './customersShared.js';

export function renderAdminCustomers(container) {
  return renderCustomersShared(container, {
    listAction: 'admin.customers.list',
    saveAction: 'admin.customers.save',
    deleteAction: 'admin.customers.delete',
    wifiSetAction: 'admin.wifi.set',
    importAction: 'admin.customers.import',
    voidPaymentAction: 'admin.payments.void',
    showBranch: false
  });
}
