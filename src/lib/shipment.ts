export const PRODUCTION_SHIPMENT_CUSTOMER = "Üretim çıkışı";

export function isUnsetShipmentCustomer(name: string | undefined): boolean {
  const value = name?.trim() ?? "";
  return !value || value === PRODUCTION_SHIPMENT_CUSTOMER;
}
