const normalize = (value: string) => value.trim().toLocaleUpperCase();

export type OrderSelections = {
  invoicesByOrder: Record<string, string[]>;
  receiptsByOrder: Record<string, string[]>;
};

export const updateOrderSelection = (
  current: OrderSelections, orderNo: string, kind: 'invoice' | 'receipt', id: string, checked: boolean,
): OrderSelections => {
  const invoices = checked ? { [orderNo]: current.invoicesByOrder[orderNo] ?? [] } : { ...current.invoicesByOrder };
  const receipts = checked ? { [orderNo]: current.receiptsByOrder[orderNo] ?? [] } : { ...current.receiptsByOrder };
  const selected = kind === 'invoice' ? invoices : receipts;
  const items = selected[orderNo] ?? [];
  selected[orderNo] = checked ? [...items.filter(item => item !== id), id] : items.filter(item => item !== id);
  return { invoicesByOrder: invoices, receiptsByOrder: receipts };
};

export const hasDuplicateInvoice = (
  invoices: { id: string; invoiceNo: string; supplierSite: string }[],
  invoiceNo: string,
  supplierSite: string,
  excludeId?: string,
) => invoices.some(invoice =>
  invoice.id !== excludeId
  && normalize(invoice.invoiceNo) === normalize(invoiceNo)
  && normalize(invoice.supplierSite) === normalize(supplierSite),
);

export const getItemNumberDifferences = (invoiceItems: string[], receiptItems: string[]) => {
  const invoice = new Map(invoiceItems.filter(item => item.trim()).map(item => [normalize(item), item.trim()]));
  const receipt = new Map(receiptItems.filter(item => item.trim()).map(item => [normalize(item), item.trim()]));
  return {
    invoiceOnly: [...invoice].filter(([key]) => !receipt.has(key)).map(([, item]) => item),
    receiptOnly: [...receipt].filter(([key]) => !invoice.has(key)).map(([, item]) => item),
  };
};

export const localDateInputValue = (date: Date) => {
  const part = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
};

export const unitCostsDiffer = (invoiceCost: number, receiptCost: number) =>
  Math.round(invoiceCost * 100) !== Math.round(receiptCost * 100);

export const costResolutionRequired = (
  aggregate: boolean, invoiceTotal: number, receiptTotal: number,
  invoiceUnitCost: number | undefined, receiptQuantity: number,
): boolean | undefined => {
  if (aggregate) return invoiceTotal !== receiptTotal;
  if (invoiceUnitCost === undefined || receiptQuantity <= 0) return undefined;
  return unitCostsDiffer(invoiceUnitCost, receiptTotal / receiptQuantity);
};
