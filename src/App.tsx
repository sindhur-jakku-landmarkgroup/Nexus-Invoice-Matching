import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  ArrowLeftOutlined,
  AuditOutlined,
  BellOutlined,
  CheckCircleFilled,
  CopyOutlined,
  DollarCircleOutlined,
  DownOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  FilterOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  HomeOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  SwapOutlined,
  SyncOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  Descriptions,
  Divider,
  Input,
  InputNumber,
  Layout,
  Menu,
  message,
  Modal,
  Pagination,
  Popover,
  Radio,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { MenuProps, TableColumnsType } from 'antd';
import { createBrowserMatchSession } from './browserMatches';
import { createInvoiceDraftItem, getInvoiceItemAmount, getInvoiceItemTotals, invoiceFinancialsChanged, reconcileInvoiceLines, validateInvoiceItems } from './invoiceItems';
import type { InvoiceDraftItem } from './invoiceItems';
import { exportInvoiceItemsCsv, importInvoiceItemsCsv } from './invoiceItemsCsv';
import { costResolutionRequired, getItemNumberDifferences, hasDuplicateInvoice, localDateInputValue, unitCostsDiffer } from './matchingRules';
import { getCurrentMatchComparison, getMatchedTotals } from './mockMatches';
import type { MatchDetails, MatchResolution, MockMatch, MockMatchState } from './mockMatches';

const noteMemoTypes = [
  'Credit note',
  'Credit Note Request - Cost',
  'Credit Note Request - Quantity',
  'Credit Note Request - Tax',
  'Debit Memo - Cost',
  'Debit Memo - Quantity',
  'Debit Memo - Tax',
  'Credit Memo - Cost',
  'Credit Memo - Quantity',
] as const;
type NoteMemoType = typeof noteMemoTypes[number];
type InvoiceStatus = 'Ready to Match' | 'Matched' | 'Posted' | 'Approved';
type InvoiceType = 'CDC' | 'CFS' | 'RDC' | 'Local' | 'DSD' | 'Direct' | NoteMemoType;

const isNoteMemo = (type: InvoiceType): type is NoteMemoType => noteMemoTypes.some(item => item === type);
const noteMemoTypeLabel = (type: NoteMemoType) => type === 'Credit note' ? 'Credit Note' : type;

type ReceiptItem = {
  item: string;
  description: string;
  quantity: number;
  unitCost: number;
  amount: number;
};

type Receipt = {
  receiptNo: string;
  date: string;
  location: string;
  quantity: number;
  amount: number;
  currency: string;
  items: ReceiptItem[];
};

type InvoiceLine = {
  item: string;
  description: string;
  invoiceQty: number;
  receiptQty: number;
  unitCost: number;
  receiptUnitCost?: number;
  tax: string;
};

type ResolutionChoice = MatchResolution & { type: NonNullable<MatchResolution['type']> };
type ResolutionDraft = MatchResolution;

type OrderResolution = {
  snapshot: string;
  isAggregate: boolean;
  quantity: ResolutionDraft;
  cost: ResolutionDraft;
  originalInvoice?: Invoice;
  originalInvoiceQty: number;
  originalReceiptQty: number;
  originalInvoiceCost: number;
  originalReceiptCost: number;
};

type ResolutionTarget = {
  orderNo: string;
  invoiceId: string;
  receiptNo: string;
  lineIndex: number;
};

type LegacyInvoiceDetails = {
  documentType: string;
  groupId: string;
  supplierSite: string;
  location: string;
  dueDate: string;
  invoiceTerms: string;
  orderTerms: string;
  supplierTerms: string;
  exchangeRate: string;
  paymentHoldStatus: string;
  detailsAttached: boolean;
  costExTax: number;
  nonMerchCostExTax: number;
  taxCost: number;
  costIncTax: number;
  invoiceQty: number;
  allowances: number;
  reference: string;
  taxCode: string;
  taxRate: number;
};

type InvoiceDraft = {
  documentType: string;
  invoiceNo: string;
  type: Exclude<InvoiceType, NoteMemoType>;
  groupId: string;
  vendorType: string;
  supplierSite: string;
  supplierSiteName: string;
  orderNo: string;
  location: string;
  currency: string;
  exchangeRate: number | null;
  invoiceDate: string;
  matchDate: string;
  dueDate: string;
  invoiceTerms: string;
  orderTerms: string;
  supplierTerms: string;
  freightPaymentType: string;
  paymentHoldStatus: string;
  ediInvoice: boolean | null;
  prePaid: boolean | null;
  manuallyPaid: boolean | null;
  detailsAttached: boolean | null;
  consignment: boolean | null;
  directStoreDelivery: boolean | null;
  evaluatedReceiptSettlement: boolean | null;
  nonMerchCostExTax: number | null;
  taxCode: string;
  taxRate: number | null;
  items: InvoiceDraftItem[];
  allowances: number | null;
  refNo1: string;
  refNo2: string;
  refNo3: string;
  refNo4: string;
};

type CreditNoteDraft = {
  documentType: NoteMemoType;
  orderInvoiceId: string;
  documentNo: string;
  documentDate: string;
  location: string;
  amount: number | null;
  requestReference: string;
  comment: string;
};

const emptyCreditNoteDraft: CreditNoteDraft = {
  documentType: 'Credit note',
  orderInvoiceId: '',
  documentNo: '',
  documentDate: '',
  location: '',
  amount: null,
  requestReference: '',
  comment: '',
};

const emptyInvoiceDraft: InvoiceDraft = {
  documentType: 'Merchandise Invoice',
  invoiceNo: '',
  type: 'RDC',
  groupId: '',
  vendorType: 'Supplier',
  supplierSite: '',
  supplierSiteName: '',
  orderNo: '',
  location: '',
  currency: 'AED',
  exchangeRate: 1,
  invoiceDate: '',
  matchDate: '',
  dueDate: '',
  invoiceTerms: 'Immediate',
  orderTerms: 'Immediate',
  supplierTerms: '30 Days Credit',
  freightPaymentType: '',
  paymentHoldStatus: 'Never Held',
  ediInvoice: false,
  prePaid: false,
  manuallyPaid: false,
  detailsAttached: true,
  consignment: false,
  directStoreDelivery: false,
  evaluatedReceiptSettlement: false,
  nonMerchCostExTax: 0,
  taxCode: 'OMSTD',
  taxRate: 5,
  items: [],
  allowances: 0,
  refNo1: '',
  refNo2: '',
  refNo3: '',
  refNo4: '',
};

type Invoice = {
  id: string;
  invoiceNo: string;
  vendor: string;
  vendorCode: string;
  supplierSiteNo?: string;
  supplierSiteName?: string;
  type: InvoiceType;
  orderNo: string;
  invoiceDate: string;
  ageDays: number;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  hasException?: boolean;
  matchedAt?: string;
  source: string;
  initials: string;
  receipts: Receipt[];
  lines: InvoiceLine[];
  taxResolved: boolean;
  tolerance: number;
  quantityTolerance?: number;
  costTolerance?: number;
  varianceCorrectionApplied?: boolean;
  conceptEscalated?: boolean;
  manualCreation?: boolean;
  reimCreationEligible?: boolean;
  legacyDetails?: LegacyInvoiceDetails;
  maintenance?: InvoiceDraft;
  financialDetails?: Pick<InvoiceDraft, 'nonMerchCostExTax' | 'taxCode' | 'taxRate' | 'allowances'>;
  quantityResolution?: ResolutionChoice;
  costResolution?: ResolutionChoice;
  noteMemoDetails?: { location: string; requestReference: string; comment: string };
  exampleLabel?: string;
};

const makeMatchingExample = (
  orderNo: string,
  exampleLabel: string,
  invoiceDate: string,
  documents: { status: 'Ready to Match' | 'Posted'; receipts: { quantity: number; amount: number }[] }[],
): Invoice[] => documents.map((document, index) => {
  const invoiceNumber = index + 1;
  return {
    id: `EX-${orderNo}-${invoiceNumber}`,
    invoiceNo: `INV-${orderNo}-${invoiceNumber}`,
    vendor: 'MHS GLOBAL TRADING LLC',
    vendorCode: '900308666',
    supplierSiteNo: '2088612',
    supplierSiteName: 'MHS GLOBAL TRADING LLC',
    type: 'CFS',
    orderNo,
    invoiceDate,
    ageDays: 0,
    amount: 10000,
    currency: 'AED',
    status: document.status,
    source: 'Illustrative matching example',
    initials: 'MH',
    receipts: document.receipts.map((receipt, receiptIndex) => ({
      receiptNo: `RCP-${orderNo}-${invoiceNumber}-${receiptIndex + 1}`,
      date: invoiceDate,
      location: 'Sharjah DC',
      ...receipt,
      currency: 'AED',
      items: [{
        item: `EX-${orderNo}-${invoiceNumber}`,
        description: 'Illustrative merchandise',
        quantity: receipt.quantity,
        unitCost: receipt.amount / receipt.quantity,
        amount: receipt.amount,
      }],
    })),
    lines: [{
      item: `EX-${orderNo}-${invoiceNumber}`,
      description: 'Illustrative merchandise',
      invoiceQty: 100,
      receiptQty: document.receipts.reduce((total, receipt) => total + receipt.quantity, 0),
      unitCost: 100,
      tax: '5%',
    }],
    taxResolved: true,
    tolerance: 0,
    exampleLabel,
  };
});

export const initialInvoices: Invoice[] = [
  {
    id: 'IM-1038',
    invoiceNo: 'INV-260374',
    vendor: 'MHS GLOBAL TRADING LLC',
    vendorCode: '900308666',
    supplierSiteNo: '2088612',
    supplierSiteName: 'MHS GLOBAL TRADING LLC',
    type: 'CFS',
    orderNo: '6502318',
    invoiceDate: '09 Nov 2026',
    ageDays: 3,
    amount: 15780,
    currency: 'AED',
    status: 'Ready to Match',
    exampleLabel: 'One invoice and one matching receipt',
    source: 'RMS Mass Upload · MU-8241',
    initials: 'MH',
    receipts: [{
      receiptNo: 'RCP-723505', date: '09 Nov 2026', location: 'Sharjah DC', quantity: 840, amount: 15780, currency: 'AED',
      items: [{ item: 'GF-104841', description: 'Ambient grocery assortment', quantity: 840, unitCost: 15780 / 840, amount: 15780 }],
    }],
    lines: [{ item: 'GF-104841', description: 'Ambient grocery assortment', invoiceQty: 840, receiptQty: 840, unitCost: 18.7857, tax: '5%' }],
    taxResolved: true,
    tolerance: 0,
  },
  ...makeMatchingExample('6502403', 'One invoice and multiple matching receipts', '18 Nov 2026', [
    { status: 'Ready to Match', receipts: [{ quantity: 50, amount: 5000 }, { quantity: 50, amount: 5000 }] },
  ]),
  {
    id: 'IM-1042',
    invoiceNo: 'INV-260381',
    vendor: 'GIZA SPINNING AND WEAVING CO',
    vendorCode: '900308963',
    supplierSiteNo: '2128534',
    supplierSiteName: 'GIZA SPINNING AND WEAVING CO',
    type: 'CDC',
    orderNo: '6502391',
    invoiceDate: '10 Nov 2026',
    ageDays: 2,
    amount: 48216.4,
    currency: 'AED',
    status: 'Ready to Match',
    exampleLabel: 'One invoice, multiple receipts, within threshold',
    source: 'STS job · STP-99821',
    initials: 'GS',
    receipts: [
      {
        receiptNo: 'RCP-723842', date: '09 Nov 2026', location: 'Dubai DC', quantity: 320, amount: 23872, currency: 'AED',
        items: [{ item: 'HC-880142', description: 'Cotton duvet set, king', quantity: 320, unitCost: 74.6, amount: 23872 }],
      },
      {
        receiptNo: 'RCP-724091', date: '10 Nov 2026', location: 'Dubai DC', quantity: 325, amount: 24244.4, currency: 'AED',
        items: [{ item: 'HC-880316', description: 'Percale pillow pair', quantity: 325, unitCost: 24244.4 / 325, amount: 24244.4 }],
      },
    ],
    lines: [
      { item: 'HC-880142', description: 'Cotton duvet set, king', invoiceQty: 320, receiptQty: 320, unitCost: 74.6, tax: '5%' },
      { item: 'HC-880316', description: 'Percale pillow pair', invoiceQty: 325, receiptQty: 325, unitCost: 74.598, tax: '5%' },
    ],
    taxResolved: true,
    tolerance: 0,
  },
  {
    id: 'IM-THRESHOLD-EXAMPLE',
    invoiceNo: 'INV-260430',
    vendor: 'R H INTERNATIONAL',
    vendorCode: '900307108',
    supplierSiteNo: '1874415',
    supplierSiteName: 'R H INTERNATIONAL',
    type: 'CFS',
    orderNo: '6502402',
    invoiceDate: '10 Nov 2026',
    ageDays: 2,
    amount: 10500,
    currency: 'AED',
    status: 'Ready to Match',
    exampleLabel: 'One invoice, multiple receipts, beyond threshold',
    source: 'Sample invoice',
    initials: 'RH',
    receipts: [
      {
        receiptNo: 'RCP-724100', date: '09 Nov 2026', location: 'Dubai DC', quantity: 50, amount: 4800, currency: 'AED',
        items: [
          { item: 'RH-100100', description: 'Sample merchandise A', quantity: 25, unitCost: 96, amount: 2400 },
          { item: 'RH-100101', description: 'Sample merchandise B', quantity: 25, unitCost: 96, amount: 2400 },
        ],
      },
      {
        receiptNo: 'RCP-724101', date: '10 Nov 2026', location: 'Dubai DC', quantity: 50, amount: 4600, currency: 'AED',
        items: [
          { item: 'RH-100100', description: 'Sample merchandise A', quantity: 25, unitCost: 92, amount: 2300 },
          { item: 'RH-100101', description: 'Sample merchandise B', quantity: 25, unitCost: 92, amount: 2300 },
        ],
      },
    ],
    lines: [
      { item: 'RH-100100', description: 'Sample merchandise A', invoiceQty: 50, receiptQty: 50, unitCost: 100, tax: '5%' },
      { item: 'RH-100101', description: 'Sample merchandise B', invoiceQty: 50, receiptQty: 50, unitCost: 100, tax: '5%' },
    ],
    financialDetails: { nonMerchCostExTax: 0, taxCode: 'OMSTD', taxRate: 5, allowances: 0 },
    taxResolved: true,
    tolerance: 0,
  },
  ...makeMatchingExample('6502404', 'Multiple matching invoice and receipt pairs', '18 Nov 2026', [
    { status: 'Ready to Match', receipts: [{ quantity: 100, amount: 10000 }] },
    { status: 'Ready to Match', receipts: [{ quantity: 100, amount: 10000 }] },
  ]),
  ...makeMatchingExample('6502405', 'Multiple pairs, one within threshold', '18 Nov 2026', [
    { status: 'Ready to Match', receipts: [{ quantity: 97, amount: 9700 }] },
    { status: 'Ready to Match', receipts: [{ quantity: 100, amount: 10000 }] },
  ]),
  ...makeMatchingExample('6502406', 'Multiple pairs, one beyond threshold', '18 Nov 2026', [
    { status: 'Ready to Match', receipts: [{ quantity: 88, amount: 8800 }] },
    { status: 'Ready to Match', receipts: [{ quantity: 100, amount: 10000 }] },
  ]),
  ...makeMatchingExample('6502411', 'One invoice and one matching receipt', '01 Oct 2026', [
    { status: 'Posted', receipts: [{ quantity: 100, amount: 10000 }] },
  ]),
  ...makeMatchingExample('6502412', 'One invoice and multiple matching receipts', '01 Oct 2026', [
    { status: 'Posted', receipts: [{ quantity: 50, amount: 5000 }, { quantity: 50, amount: 5000 }] },
  ]),
  ...makeMatchingExample('6502413', 'One invoice, multiple receipts, within threshold', '01 Oct 2026', [
    { status: 'Posted', receipts: [{ quantity: 50, amount: 5000 }, { quantity: 47, amount: 4700 }] },
  ]),
  ...makeMatchingExample('6502414', 'One invoice, multiple receipts, beyond threshold', '01 Oct 2026', [
    { status: 'Posted', receipts: [{ quantity: 50, amount: 5000 }, { quantity: 38, amount: 3800 }] },
  ]),
  ...makeMatchingExample('6502415', 'Multiple matching invoice and receipt pairs', '01 Oct 2026', [
    { status: 'Posted', receipts: [{ quantity: 100, amount: 10000 }] },
    { status: 'Posted', receipts: [{ quantity: 100, amount: 10000 }] },
  ]),
  ...makeMatchingExample('6502416', 'Multiple pairs, one within threshold', '01 Oct 2026', [
    { status: 'Posted', receipts: [{ quantity: 97, amount: 9700 }] },
    { status: 'Posted', receipts: [{ quantity: 100, amount: 10000 }] },
  ]),
  ...makeMatchingExample('6502417', 'Multiple pairs, one beyond threshold', '01 Oct 2026', [
    { status: 'Posted', receipts: [{ quantity: 88, amount: 8800 }] },
    { status: 'Posted', receipts: [{ quantity: 100, amount: 10000 }] },
  ]),
  ...makeMatchingExample('6502420', 'Two matching invoice and receipt pairs, one posted and one ready to match', '18 Nov 2026', [
    { status: 'Posted', receipts: [{ quantity: 100, amount: 10000 }] },
    { status: 'Ready to Match', receipts: [{ quantity: 100, amount: 10000 }] },
  ]).map(invoice => invoice.status === 'Posted' ? {
    ...invoice,
    invoiceDate: '01 Oct 2026',
    receipts: invoice.receipts.map(receipt => ({ ...receipt, date: '01 Oct 2026' })),
  } : invoice),
  ...([
    { type: 'Credit Note Request - Quantity', status: 'Approved', orderNo: '6502430', invoiceNo: 'CNR-6502430', amount: 100, exampleLabel: 'Approved quantity credit note request' },
    { type: 'Credit note', status: 'Posted', orderNo: '6502431', invoiceNo: 'CN-6502431', amount: -100, exampleLabel: 'Posted credit note' },
    { type: 'Debit Memo - Cost', status: 'Posted', orderNo: '6502432', invoiceNo: 'DM-6502432', amount: 100, exampleLabel: 'Posted cost debit memo' },
  ] as const).map((document): Invoice => ({
    id: `EX-${document.invoiceNo}`,
    ...document,
    vendor: 'MHS GLOBAL TRADING LLC',
    vendorCode: '900308666',
    supplierSiteNo: '2088612',
    supplierSiteName: 'MHS GLOBAL TRADING LLC',
    invoiceDate: '01 Oct 2026',
    ageDays: 0,
    currency: 'AED',
    source: 'Illustrative note and memo example',
    initials: 'MH',
    receipts: [],
    lines: [],
    taxResolved: true,
    tolerance: 0,
  })),
  {
    id: 'IM-1021',
    invoiceNo: 'LPI-88312',
    vendor: 'VERSAILLES ZONE FZE',
    vendorCode: '900309106',
    supplierSiteNo: '2150522',
    supplierSiteName: 'VERSAILLES ZONE FZE',
    type: 'Local',
    orderNo: '4500814',
    invoiceDate: '08 Nov 2026',
    ageDays: 4,
    amount: 12654,
    currency: 'AED',
    status: 'Ready to Match',
    source: 'Local AP invoice · source integration',
    initials: 'VZ',
    receipts: [{
      receiptNo: 'RCP-722988', date: '08 Nov 2026', location: 'Abu Dhabi store', quantity: 98, amount: 12201, currency: 'AED',
      items: [{ item: 'TX-442190', description: 'Hotel collection bath towel', quantity: 98, unitCost: 124.5, amount: 12201 }],
    }],
    lines: [{ item: 'TX-442190', description: 'Hotel collection bath towel', invoiceQty: 100, receiptQty: 98, unitCost: 126.54, tax: '5%' }],
    taxResolved: true,
    tolerance: 2,
    quantityTolerance: 2,
    costTolerance: 1,
  },
  {
    id: 'IM-0891',
    invoiceNo: 'INV-260411',
    vendor: 'COIN MAISON FOR MARKETING SERVICES VIA SOCIAL MEDIA',
    vendorCode: '900309137',
    supplierSiteNo: '2153545',
    supplierSiteName: 'COIN MAISON FOR MARKETING SERVICES VIA SOCIAL MEDIA',
    type: 'CFS',
    orderNo: '6501422',
    invoiceDate: '05 Nov 2026',
    ageDays: 6,
    amount: 5250,
    currency: 'AED',
    status: 'Ready to Match',
    source: 'Invoice and receipt comparison',
    initials: 'CM',
    receipts: [{
      receiptNo: 'RCP-722140', date: '04 Nov 2026', location: 'Dubai DC', quantity: 100, amount: 4800, currency: 'AED',
      items: [{ item: 'NS-400220', description: 'Bath towel set', quantity: 100, unitCost: 48, amount: 4800 }],
    }],
    lines: [{ item: 'NS-400220', description: 'Bath towel set', invoiceQty: 105, receiptQty: 100, unitCost: 50, receiptUnitCost: 48, tax: '0%' }],
    taxResolved: true,
    tolerance: 5,
    quantityTolerance: 5,
    costTolerance: 2,
  },
  {
    id: 'IM-0889',
    invoiceNo: 'INV-260408',
    vendor: 'R H INTERNATIONAL',
    vendorCode: '900307108',
    supplierSiteNo: '1874415',
    supplierSiteName: 'R H INTERNATIONAL',
    type: 'CFS',
    orderNo: '6501399',
    invoiceDate: '04 Nov 2026',
    ageDays: 7,
    amount: 6325,
    currency: 'AED',
    status: 'Ready to Match',
    hasException: true,
    source: 'Invoice and receipt comparison',
    initials: 'RH',
    receipts: [{
      receiptNo: 'RCP-721994', date: '03 Nov 2026', location: 'Sharjah DC', quantity: 100, amount: 4800, currency: 'AED',
      items: [{ item: 'CL-390114', description: 'Living room storage unit', quantity: 100, unitCost: 48, amount: 4800 }],
    }],
    lines: [{ item: 'CL-390114', description: 'Living room storage unit', invoiceQty: 115, receiptQty: 100, unitCost: 55, receiptUnitCost: 48, tax: '0%' }],
    taxResolved: true,
    tolerance: 5,
    quantityTolerance: 5,
    costTolerance: 2,
  },
  {
    id: 'IM-0998',
    invoiceNo: 'INV-260319',
    vendor: 'MAXIM HANDICRAFTS',
    vendorCode: '900306465',
    supplierSiteNo: '2325854',
    supplierSiteName: 'MAXIM HANDICRAFTS',
    type: 'CDC',
    orderNo: '6501870',
    invoiceDate: '02 Nov 2026',
    ageDays: 8,
    amount: 32880,
    currency: 'AED',
    status: 'Ready to Match',
    hasException: true,
    source: 'STS job · STP-99402',
    initials: 'MH',
    receipts: [],
    lines: [{ item: 'DC-409218', description: 'Home storage set', invoiceQty: 240, receiptQty: 0, unitCost: 137, tax: '5%' }],
    taxResolved: true,
    tolerance: 0,
  },
  {
    id: 'IM-0987',
    invoiceNo: 'INV-260305',
    vendor: 'HORNDREN PAPER PRODUCTS INDUSTRIAL LIMITED',
    vendorCode: '900306897',
    supplierSiteNo: '1849299',
    supplierSiteName: 'HORNDREN PAPER PRODUCTS INDUSTRIAL LIMITED',
    type: 'RDC',
    orderNo: '6501703',
    invoiceDate: '01 Nov 2026',
    ageDays: 9,
    amount: 8175.5,
    currency: 'AED',
    status: 'Ready to Match',
    hasException: true,
    source: 'RPA exception report · EX-1208',
    initials: 'HP',
    receipts: [{
      receiptNo: 'RCP-721901', date: '31 Oct 2026', location: 'Riyadh DC', quantity: 55, amount: 7628, currency: 'AED',
      items: [{ item: 'RD-113005', description: 'Direct shipment assortment', quantity: 55, unitCost: 7628 / 55, amount: 7628 }],
    }],
    lines: [{ item: 'RD-113005', description: 'Direct shipment assortment', invoiceQty: 59, receiptQty: 55, unitCost: 138.57, tax: '5%' }],
    taxResolved: true,
    tolerance: 0,
  },
  {
    id: 'IM-0974',
    invoiceNo: 'CN-260241',
    vendor: '3COLOR INDUSTRY AND TRADING CO LTD',
    vendorCode: '900307970',
    supplierSiteNo: '2003276',
    supplierSiteName: '3COLOR INDUSTRY AND TRADING CO LTD',
    type: 'Credit note',
    orderNo: '4500722',
    invoiceDate: '31 Oct 2026',
    ageDays: 10,
    amount: -1240,
    currency: 'AED',
    status: 'Posted',
    source: 'Cognix · Credit note',
    initials: '3C',
    receipts: [],
    lines: [{ item: 'AF-001180', description: 'Supplier credit adjustment', invoiceQty: 1, receiptQty: 1, unitCost: -1240, tax: '5%' }],
    taxResolved: true,
    tolerance: 0,
  },
  {
    id: 'IM-0962',
    invoiceNo: 'Pending creation',
    vendor: 'XIAMEN BABY PRETTY PRODUCTS CO LTD',
    vendorCode: '900307359',
    supplierSiteNo: '1908407',
    supplierSiteName: 'XIAMEN BABY PRETTY PRODUCTS CO LTD',
    type: 'CFS',
    orderNo: '6501638',
    invoiceDate: '30 Oct 2026',
    ageDays: 11,
    amount: 9420,
    currency: 'AED',
    status: 'Ready to Match',
    hasException: true,
    source: 'STS/STPS job missing · accrued liability pending',
    initials: 'XB',
    receipts: [{
      receiptNo: 'RCP-721220', date: '29 Oct 2026', location: 'Dubai DC', quantity: 120, amount: 9420, currency: 'AED',
      items: [{ item: 'AU-615200', description: 'Decorative home assortment', quantity: 120, unitCost: 78.5, amount: 9420 }],
    }],
    lines: [{ item: 'AU-615200', description: 'Decorative home assortment', invoiceQty: 120, receiptQty: 120, unitCost: 78.5, tax: '5%' }],
    taxResolved: true,
    tolerance: 0,
    reimCreationEligible: true,
  },
  {
    id: 'IM-SAMPLE-10',
    invoiceNo: 'INV-SAMPLE-10',
    vendor: 'GOEL HANDICRAFTS',
    vendorCode: '900307535',
    supplierSiteNo: '1939302',
    supplierSiteName: 'GOEL HANDICRAFTS',
    type: 'CFS',
    orderNo: '6502400',
    invoiceDate: '10 Nov 2026',
    ageDays: 2,
    amount: 5000,
    currency: 'AED',
    status: 'Ready to Match',
    source: 'Sample invoice',
    initials: 'GH',
    receipts: [{
      receiptNo: 'RCP-SAMPLE-10', date: '09 Nov 2026', location: 'Dubai DC', quantity: 100, amount: 5000, currency: 'AED',
      items: [{ item: 'SAMPLE-10', description: 'Sample merchandise', quantity: 100, unitCost: 50, amount: 5000 }],
    }],
    lines: [{ item: 'SAMPLE-10', description: 'Sample merchandise', invoiceQty: 100, receiptQty: 100, unitCost: 50, tax: '5%' }],
    taxResolved: true,
    tolerance: 0,
  },
  {
    id: 'IM-SAMPLE-11',
    invoiceNo: 'INV-SAMPLE-11',
    vendor: 'BRAND HUB FZC',
    vendorCode: '900308602',
    supplierSiteNo: '2085455',
    supplierSiteName: 'BRAND HUB FZC',
    type: 'CFS',
    orderNo: '6502401',
    invoiceDate: '10 Nov 2026',
    ageDays: 2,
    amount: 3000,
    currency: 'AED',
    status: 'Posted',
    source: 'Sample invoice · posted after matching',
    initials: 'BH',
    receipts: [{
      receiptNo: 'RCP-SAMPLE-11', date: '09 Nov 2026', location: 'Dubai DC', quantity: 60, amount: 3000, currency: 'AED',
      items: [{ item: 'SAMPLE-11', description: 'Sample merchandise', quantity: 60, unitCost: 50, amount: 3000 }],
    }],
    lines: [{ item: 'SAMPLE-11', description: 'Sample merchandise', invoiceQty: 60, receiptQty: 60, unitCost: 50, tax: '5%' }],
    taxResolved: true,
    tolerance: 0,
  },
  {
    id: 'IM-0948',
    invoiceNo: 'INHC0048419',
    vendor: 'Intercoil International Co',
    vendorCode: '900027634',
    type: 'RDC',
    orderNo: '1928176',
    invoiceDate: '03 Mar 2026',
    ageDays: 252,
    amount: 661.5,
    currency: 'AED',
    status: 'Ready to Match',
    source: 'Legacy Oracle invoice sample',
    initials: 'II',
    receipts: [],
    lines: [],
    taxResolved: true,
    tolerance: 0,
    legacyDetails: {
      documentType: 'Merchandise Invoice',
      groupId: '2135857',
      supplierSite: '1122317',
      location: '1004000 · Home Centre RPW in UAE RDC',
      dueDate: '03 Mar 2026',
      invoiceTerms: '10000 · Immediate',
      orderTerms: '10000 · Immediate',
      supplierTerms: '10020 · 30 Days Credit',
      exchangeRate: '1.0',
      paymentHoldStatus: 'Never Held',
      detailsAttached: true,
      costExTax: 630,
      nonMerchCostExTax: 0,
      taxCost: 31.5,
      costIncTax: 661.5,
      invoiceQty: 3,
      allowances: 0,
      reference: 'AERML_20260304_3040504',
      taxCode: 'OMSTD',
      taxRate: 5,
    },
  },
];

const statusColor: Record<InvoiceStatus, string> = {
  'Ready to Match': 'cyan',
  Matched: 'green',
  Posted: 'blue',
  Approved: 'green',
};

const DISCREPANCY_THRESHOLD_PCT = 5;

// Helper function to calculate variance percentage
const getVariancePercentage = (variance: number, baseAmount: number): number => {
  if (baseAmount === 0) return variance === 0 ? 0 : Infinity;
  return Math.abs((variance / baseAmount) * 100);
};

const formatVariancePercentage = (variance: number, baseAmount: number): string => {
  const percentage = getVariancePercentage(variance, baseAmount);
  return Number.isFinite(percentage) ? `${percentage.toFixed(2)}%` : 'N/A';
};

const resolutionLabel = (choice?: ResolutionDraft): string => {
  if (choice?.type === 'invoice') return 'Resolved: Invoice';
  if (choice?.type === 'receipt') return 'Resolved: Receipt';
  if (choice?.type === 'defer') return 'Deferred: Resolution required';
  return 'Resolution required';
};

const resolutionReasons: Record<string, string> = {
  shortage: 'Shortage',
  damaged: 'Damaged goods',
  qty_error: 'Quantity error',
  pricing: 'Pricing error',
  discount: 'Discount not applied',
  cost_error: 'Cost error',
};

// Helper function to check if quantity variance exceeds tolerance
const exceedsQuantityTolerance = (variance: number, invoiceQty: number): boolean => {
  if (invoiceQty === 0) return variance !== 0;
  return Math.abs(variance) > Math.abs(invoiceQty) * DISCREPANCY_THRESHOLD_PCT / 100;
};

// Helper function to check if cost variance exceeds tolerance
const exceedsCostTolerance = (variance: number, invoiceCost: number): boolean => {
  if (invoiceCost === 0) return variance !== 0;
  return Math.abs(variance) > Math.abs(invoiceCost) * DISCREPANCY_THRESHOLD_PCT / 100;
};

// Get match status for order-based matching
type MatchStatus = 'perfect' | 'within-tolerance' | 'exceeds-tolerance';

const getOrderMatchStatus = (
  invoiceQty: number,
  receiptQty: number,
  invoiceCost: number,
  receiptCost: number
): MatchStatus => {
  const qtyVariance = invoiceQty - receiptQty;
  const costVariance = invoiceCost - receiptCost;
  
  if (qtyVariance === 0 && costVariance === 0) return 'perfect';
  
  const qtyExceeds = exceedsQuantityTolerance(qtyVariance, invoiceQty);
  const costExceeds = exceedsCostTolerance(costVariance, invoiceCost);
  
  if (qtyExceeds || costExceeds) return 'exceeds-tolerance';
  return 'within-tolerance';
};

const legacyTaxCodes = [
  { code: 'VAT11', rate: 0 },
  { code: 'BHIVGO', rate: 0 },
  { code: 'AEMP', rate: 0 },
  { code: 'VAT13', rate: 13 },
  { code: 'OMSTD', rate: 5 },
  { code: 'BHZER0', rate: 0 },
  { code: 'VAT10', rate: 10 },
  { code: 'OMEXE0', rate: 0 },
  { code: 'VAT12', rate: 12 },
  { code: 'OM00S0', rate: 0 },
  { code: 'VAT8', rate: 8 },
  { code: 'EXEMPT', rate: 0 },
  { code: 'SAZERO', rate: 0 },
];

const money = (value: number, currency = 'AED') =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

const unitMoney = (value: number, currency: string) =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency, maximumFractionDigits: 4 }).format(value);

export const getFinancePostingLines = (receiptAmount: number, now: Date) => {
  const glDate = new Date(now);
  glDate.setDate(glDate.getDate() + 1);
  const date = glDate.toLocaleDateString('en-AE');
  return [
    { accountCode: '24109-0000-0000', description: 'AP Liability', amount: receiptAmount, glDate: date },
    { accountCode: '64318-0000-0000', description: 'Adjustment', amount: receiptAmount, glDate: date },
  ];
};

const invoiceDateInput = (date: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const invoiceToDraft = (invoice: Invoice): InvoiceDraft => {
  if (isNoteMemo(invoice.type)) throw new Error('Notes and memos cannot be edited as invoices.');
  const legacy = invoice.legacyDetails;
  const stored = invoice.maintenance;
  return {
    ...emptyInvoiceDraft,
    documentType: stored?.documentType ?? legacy?.documentType ?? 'Merchandise Invoice',
    invoiceNo: invoice.invoiceNo,
    type: invoice.type,
    groupId: stored?.groupId ?? legacy?.groupId ?? '',
    vendorType: stored?.vendorType ?? '',
    supplierSite: invoice.supplierSiteNo ?? legacy?.supplierSite ?? '',
    supplierSiteName: invoice.supplierSiteName ?? '',
    orderNo: invoice.orderNo,
    location: stored?.location ?? legacy?.location ?? '',
    currency: invoice.currency,
    exchangeRate: stored?.exchangeRate ?? (legacy ? Number(legacy.exchangeRate) : null),
    invoiceDate: invoiceDateInput(invoice.invoiceDate),
    matchDate: stored?.matchDate || (invoice.matchedAt ? invoiceDateInput(invoice.matchedAt) : ''),
    dueDate: stored?.dueDate ?? (legacy ? invoiceDateInput(legacy.dueDate) : ''),
    invoiceTerms: stored?.invoiceTerms ?? legacy?.invoiceTerms ?? '',
    orderTerms: stored?.orderTerms ?? legacy?.orderTerms ?? '',
    supplierTerms: stored?.supplierTerms ?? legacy?.supplierTerms ?? '',
    freightPaymentType: stored?.freightPaymentType ?? '',
    paymentHoldStatus: stored?.paymentHoldStatus ?? legacy?.paymentHoldStatus ?? '',
    ediInvoice: stored?.ediInvoice ?? null,
    prePaid: stored?.prePaid ?? null,
    manuallyPaid: stored?.manuallyPaid ?? null,
    detailsAttached: stored?.detailsAttached ?? legacy?.detailsAttached ?? null,
    consignment: stored?.consignment ?? null,
    directStoreDelivery: stored?.directStoreDelivery ?? null,
    evaluatedReceiptSettlement: stored?.evaluatedReceiptSettlement ?? null,
    nonMerchCostExTax: stored?.nonMerchCostExTax ?? legacy?.nonMerchCostExTax ?? invoice.financialDetails?.nonMerchCostExTax ?? null,
    taxCode: stored?.taxCode ?? legacy?.taxCode ?? invoice.financialDetails?.taxCode ?? '',
    taxRate: stored?.taxRate ?? legacy?.taxRate ?? invoice.financialDetails?.taxRate ?? null,
    items: invoice.lines.map((line, index) => ({
      id: stored?.items[index]?.id ?? crypto.randomUUID(),
      item: line.item,
      description: line.description,
      quantity: line.invoiceQty,
      unitCost: line.unitCost,
    })),
    allowances: stored?.allowances ?? legacy?.allowances ?? invoice.financialDetails?.allowances ?? null,
    refNo1: stored?.refNo1 ?? legacy?.reference ?? '',
    refNo2: stored?.refNo2 ?? '',
    refNo3: stored?.refNo3 ?? '',
    refNo4: stored?.refNo4 ?? '',
  };
};

const navigationItems: MenuProps['items'] = [
  { key: 'services', icon: <HomeOutlined />, label: 'All Services' },
  { key: 'classic', icon: <DollarCircleOutlined />, label: 'Open RMS Classic' },
  { type: 'divider' },
  { key: 'matching', icon: <SwapOutlined />, label: 'Invoice matching' },
  { key: 'reports', icon: <AuditOutlined />, label: 'Reports' },
];

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [matchState, setMatchState] = useState<MockMatchState | null>(null);
  const [matchServiceError, setMatchServiceError] = useState('');
  const [matchSession] = useState(createBrowserMatchSession);
  const [selectedId, setSelectedId] = useState('IM-1042');
  const [selectedReceipts, setSelectedReceipts] = useState<Record<string, string[]>>({});
  const [filter, setFilter] = useState('All invoices');
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('matching');
  const [taxBreakdownOpen, setTaxBreakdownOpen] = useState(false);
  const [reimCreateOpen, setReimCreateOpen] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>(emptyInvoiceDraft);
  const createDraftBaseline = useRef<InvoiceDraft | null>(null);
  const [discardInvoiceDraftOpen, setDiscardInvoiceDraftOpen] = useState(false);
  const [detailDraftBaseline, setDetailDraftBaseline] = useState<InvoiceDraft | null>(null);
  const [editingInvoice, setEditingInvoice] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const invoicesRef = useRef(invoices);
  invoicesRef.current = invoices;
  const detailInvoiceAtOpen = useRef<Invoice | null>(null);
  const [pendingInvoiceItems, setPendingInvoiceItems] = useState<InvoiceDraftItem[] | null>(null);
  const invoiceItemsFileRef = useRef<HTMLInputElement>(null);
  const invoiceItemsReadId = useRef(0);
  const [creditNoteCreateOpen, setCreditNoteCreateOpen] = useState(false);
  const [creditNoteDraft, setCreditNoteDraft] = useState<CreditNoteDraft>(emptyCreditNoteDraft);
  const [taxEditorOpen, setTaxEditorOpen] = useState(false);
  const taxEditorOriginal = useRef<{ taxCode: string; taxRate: number | null } | null>(null);
  const [localRuleApplied, setLocalRuleApplied] = useState(false);
  const [resolveDiscrepancyOpen, setResolveDiscrepancyOpen] = useState(false);
  const [resolutionTarget, setResolutionTarget] = useState<ResolutionTarget | null>(null);
  const [quantityResolution, setQuantityResolution] = useState<ResolutionDraft>({});
  const [costResolution, setCostResolution] = useState<ResolutionDraft>({});
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [selectedMultiReceipts, setSelectedMultiReceipts] = useState<Set<string>>(new Set());
  
  // ORDER-BASED FILTERING AND SELECTION
  const [orderFilter, setOrderFilter] = useState<string>('');
  const [supplierSiteFilter, setSupplierSiteFilter] = useState<string>('');
  const [documentFilter, setDocumentFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);
  const [selectedInvoicesByOrder, setSelectedInvoicesByOrder] = useState<Record<string, string[]>>({});
  const [selectedReceiptsByOrder, setSelectedReceiptsByOrder] = useState<Record<string, string[]>>({});
  const [orderResolutions, setOrderResolutions] = useState<Record<string, OrderResolution>>({});
  const [matchDetailsKey, setMatchDetailsKey] = useState<{ orderNo: string; invoiceId: string } | null>(null);

  const updateMatchState = (next: MockMatchState) => {
    setMatchState(current => !current || current.instanceId !== next.instanceId || next.version >= current.version ? next : current);
  };

  useEffect(() => {
    let active = true;
    const refreshMatches = async () => {
      try {
        const data = await matchSession.getMatches();
        if (active) {
          updateMatchState(data);
          setMatchServiceError('');
        }
      } catch (error) {
        if (active) setMatchServiceError(error instanceof Error ? error.message : 'Unable to reach the match service.');
      }
    };
    void refreshMatches();
    return () => { active = false; };
  }, [matchSession]);

  useEffect(() => {
    if (!matchState) return;
    setInvoices(current => {
      let changed = false;
      const updated = current.map(invoice => {
        if (isNoteMemo(invoice.type)) return invoice;
        const match = matchState.matches.find(item => item.invoiceIds.includes(invoice.id));
        if (!match || (invoice.status === match.status && invoice.matchedAt === match.matchedAt)) return invoice;
        changed = true;
        return { ...invoice, status: match.status, matchedAt: match.matchedAt, hasException: false };
      });
      return changed ? updated : current;
    });
  }, [matchState]);
  
  // DETAIL VIEWER STATE
  const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(false);
  const [receiptDetailOpen, setReceiptDetailOpen] = useState(false);
  const [detailInvoiceId, setDetailInvoiceId] = useState<string>('');
  const [detailReceiptKey, setDetailReceiptKey] = useState<{ orderNo: string; receiptNo: string } | null>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportOrderNo, setReportOrderNo] = useState('');
  const [reportRecipients, setReportRecipients] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportComment, setReportComment] = useState('');
  const [exceptionReports, setExceptionReports] = useState<Record<string, { recipients: string[]; reason: string; comment: string; timestamp: string; invoiceIds: string[]; receiptNos: string[] }[]>>({});

  // PHASE 2 ENHANCEMENTS: OFIN POSTING STATE
  const [offinPostings, setOffinPostings] = useState<Record<string, {
    status: string; referenceNumber: string; currency: string | null; receiptCurrency: string | null;
    invoiceNumbers: string[]; receiptNos: string[]; matchedQuantity: number; matchedAmount: number;
    lineItems: { accountCode: string; amount: number; glDate: string; description: string }[]; timestamp: string;
  }>>({});
  const [postingConfirmationOpen, setPostingConfirmationOpen] = useState(false);
  const [postingOrderNo, setPostingOrderNo] = useState<string>('');

  const selectedInvoice = invoices.find(invoice => invoice.id === selectedId) ?? invoices[0];
  // FILTER HELPER FUNCTIONS FOR ORDER-BASED GROUPING
  const getFilteredOrders = () => {
    const uniqueOrders = new Map<string, { orderNo: string; invoices: Invoice[] }>();
    
    invoices.forEach(inv => {
      const matchesOrderFilter = !orderFilter || inv.orderNo.includes(orderFilter);
      const matchesSupplierSiteFilter = !supplierSiteFilter || getSupplierSiteNumber(inv) === supplierSiteFilter;
      const matchesStatusFilter = !statusFilter || inv.status === statusFilter;
      
      if (matchesOrderFilter && matchesSupplierSiteFilter && matchesStatusFilter) {
        const orderNo = inv.orderNo;
        if (!uniqueOrders.has(orderNo)) {
          uniqueOrders.set(orderNo, {
            orderNo,
            invoices: [],
          });
        }
        uniqueOrders.get(orderNo)!.invoices.push(inv);
      }
    });
    
    const documentQuery = documentFilter.trim().toLowerCase();
    return Array.from(uniqueOrders.values()).filter(order =>
      !documentQuery || order.invoices.some(invoice => invoice.invoiceNo.toLowerCase().includes(documentQuery)),
    );
  };

  const getReceiptsForOrder = (orderNo: string) => {
    const allReceipts = new Set<Receipt>();
    invoices.filter(inv => inv.orderNo === orderNo).forEach(inv => {
      inv.receipts.forEach(receipt => allReceipts.add(receipt));
    });
    return Array.from(allReceipts);
  };

  const getOrderNumbers = () => Array.from(new Set(invoices.map(inv => inv.orderNo)));
  const getSupplierSiteNumber = (invoice: Invoice) => invoice.supplierSiteNo || invoice.legacyDetails?.supplierSite || '';
  const invoiceNumberExists = (list: Invoice[], invoiceNo: string, supplierSite: string, excludeId?: string) =>
    hasDuplicateInvoice(list.filter(invoice => !isNoteMemo(invoice.type)).map(invoice => ({
      id: invoice.id, invoiceNo: invoice.invoiceNo, supplierSite: getSupplierSiteNumber(invoice),
    })), invoiceNo, supplierSite, excludeId);
  const getSupplierSiteName = (invoice: Invoice) => invoice.supplierSiteName?.trim() || 'Description unavailable';
  const getSupplierSiteDisplay = (invoice: Invoice) => `${getSupplierSiteNumber(invoice) || 'Number unavailable'} · ${getSupplierSiteName(invoice)}`;
  const getSupplierSites = () => {
    const sites = new Map<string, string>();
    invoices.forEach(invoice => {
      const number = getSupplierSiteNumber(invoice);
      if (number && (!sites.has(number) || invoice.supplierSiteName)) {
        sites.set(number, invoice.supplierSiteName || 'Description unavailable');
      }
    });
    return Array.from(sites, ([value, name]) => ({ value, label: `${value} · ${name}` }));
  };
  const getStatuses = (): InvoiceStatus[] => ['Ready to Match', 'Matched', 'Posted', 'Approved'];

  const getCumulativeInvoiceQtyByOrder = (orderNo: string) => {
    return (selectedInvoicesByOrder[orderNo] || []).reduce((sum, invId) => {
      const inv = invoices.find(i => i.id === invId);
      return sum + (inv?.lines.reduce((total, line) => total + line.invoiceQty, 0) ?? 0);
    }, 0);
  };

  const getCumulativeInvoiceCostByOrder = (orderNo: string) => {
    return (selectedInvoicesByOrder[orderNo] || []).reduce((sum, invId) => {
      const inv = invoices.find(i => i.id === invId);
      return sum + (inv?.amount || 0);
    }, 0);
  };

  const getCumulativeReceiptQtyByOrder = (orderNo: string) => {
    return (selectedReceiptsByOrder[orderNo] || []).reduce((sum, receiptNo) => {
      const receipt = getReceiptsForOrder(orderNo).find(r => r.receiptNo === receiptNo);
      return sum + (receipt?.quantity || 0);
    }, 0);
  };

  const getCumulativeReceiptCostByOrder = (orderNo: string) => {
    return (selectedReceiptsByOrder[orderNo] || []).reduce((sum, receiptNo) => {
      const receipt = getReceiptsForOrder(orderNo).find(r => r.receiptNo === receiptNo);
      return sum + (receipt?.amount || 0);
    }, 0);
  };

  const getResolutionSnapshot = (orderNo: string, invoiceList: Invoice[]) => {
    const invoiceIds = [...(selectedInvoicesByOrder[orderNo] || [])].sort();
    const receiptNos = [...(selectedReceiptsByOrder[orderNo] || [])].sort();
    const orderInvoices = invoiceList.filter(invoice => invoice.orderNo === orderNo);
    return JSON.stringify({
      invoices: invoiceIds.map(id => {
        const invoice = orderInvoices.find(item => item.id === id);
        return invoice && { id, amount: invoice.amount, lines: invoice.lines };
      }),
      receipts: receiptNos.map(receiptNo => {
        const receipt = orderInvoices.flatMap(invoice => invoice.receipts).find(item => item.receiptNo === receiptNo);
        return receipt && { receiptNo, quantity: receipt.quantity, amount: receipt.amount };
      }),
    });
  };

  const getCurrentOrderResolution = (orderNo: string) => {
    const resolution = orderResolutions[orderNo];
    return resolution?.snapshot === getResolutionSnapshot(orderNo, invoices) ? resolution : undefined;
  };

  const hasResolvedOrderVariance = (orderNo: string) => {
    const resolution = getCurrentOrderResolution(orderNo);
    if (!resolution) return false;
    const quantityDiffers = resolution.originalInvoiceQty !== resolution.originalReceiptQty;
    const costDiffers = costResolutionRequired(resolution.isAggregate, resolution.originalInvoiceCost,
      resolution.originalReceiptCost, resolution.originalInvoice?.lines[0]?.unitCost, resolution.originalReceiptQty);
    if (costDiffers === undefined) return false;
    return (!quantityDiffers || (resolution.quantity.type !== undefined && resolution.quantity.type !== 'defer'))
      && (!costDiffers || (resolution.cost.type !== undefined && resolution.cost.type !== 'defer'));
  };

  const activeOrderResolution = resolutionTarget ? getCurrentOrderResolution(resolutionTarget.orderNo) : undefined;
  const resolutionInvoice = activeOrderResolution?.originalInvoice
    ?? invoices.find(invoice => invoice.id === resolutionTarget?.invoiceId && invoice.orderNo === resolutionTarget.orderNo);
  const resolutionReceipt = invoices
    .filter(invoice => invoice.orderNo === resolutionTarget?.orderNo)
    .flatMap(invoice => invoice.receipts)
    .find(receipt => receipt.receiptNo === resolutionTarget?.receiptNo);
  const resolutionLine = resolutionInvoice?.lines[resolutionTarget?.lineIndex ?? -1];
  const resolutionReceiptCost = resolutionReceipt && resolutionReceipt.quantity > 0
    ? resolutionReceipt.amount / resolutionReceipt.quantity
    : undefined;
  const resolutionQtyMismatch = !!resolutionLine && !!resolutionReceipt && resolutionLine.invoiceQty !== resolutionReceipt.quantity;
  const resolutionCostMismatch = !!resolutionLine && resolutionReceiptCost !== undefined
    && unitCostsDiffer(resolutionLine.unitCost, resolutionReceiptCost);
  const resolutionIsAggregate = !!resolutionTarget && (
    (selectedInvoicesByOrder[resolutionTarget.orderNo] || []).length > 1
    || (selectedReceiptsByOrder[resolutionTarget.orderNo] || []).length > 1
    || (resolutionInvoice?.lines.length ?? 0) > 1
    || (!!resolutionInvoice && !!resolutionLine
      && Math.round(resolutionInvoice.amount * 100) !== Math.round(resolutionLine.invoiceQty * resolutionLine.unitCost * 100))
  );

  const clearOrderResolution = (orderNo: string) => {
    setOrderResolutions(current => {
      const updated = { ...current };
      delete updated[orderNo];
      return updated;
    });
  };

  const getReceiptMatch = (orderNo: string, receiptNo: string) =>
    matchState?.matches.find(match => match.orderNo === orderNo && match.receiptNos.includes(receiptNo));

  const getInvoiceMatch = (orderNo: string, invoiceId: string) =>
    matchState?.matches.find(match => match.orderNo === orderNo && match.invoiceIds.includes(invoiceId));

  const getMatchInvoiceNumber = (match: MockMatch, id: string) =>
    match.details?.invoiceNumbers.find(invoice => invoice.id === id)?.number
    ?? invoices.find(invoice => invoice.id === id)?.invoiceNo ?? id;

  const selectedMatchDetails = matchDetailsKey
    ? getInvoiceMatch(matchDetailsKey.orderNo, matchDetailsKey.invoiceId)
    : undefined;

  useEffect(() => {
    if (!matchState) return;
    const updatedInvoices: Record<string, string[]> = {};
    const updatedReceipts: Record<string, string[]> = {};
    const changedOrders = new Set<string>();
    Object.entries(selectedInvoicesByOrder).forEach(([orderNo, invoiceIds]) => {
      updatedInvoices[orderNo] = invoiceIds.filter(id =>
        !getInvoiceMatch(orderNo, id) && invoices.some(invoice => invoice.id === id && invoice.status === 'Ready to Match'),
      );
      if (updatedInvoices[orderNo].length !== invoiceIds.length) changedOrders.add(orderNo);
    });
    Object.entries(selectedReceiptsByOrder).forEach(([orderNo, receiptNos]) => {
      updatedReceipts[orderNo] = receiptNos.filter(receiptNo => !getReceiptMatch(orderNo, receiptNo));
      if (updatedReceipts[orderNo].length !== receiptNos.length) changedOrders.add(orderNo);
    });
    if (changedOrders.size) {
      setSelectedInvoicesByOrder(updatedInvoices);
      setSelectedReceiptsByOrder(updatedReceipts);
      setOrderResolutions(current => {
        const next = { ...current };
        changedOrders.forEach(orderNo => { delete next[orderNo]; });
        return next;
      });
    }
  }, [matchState, invoices, selectedInvoicesByOrder, selectedReceiptsByOrder]);

  const hasOrderVariance = (orderNo: string) => {
    const invoiceQty = getCumulativeInvoiceQtyByOrder(orderNo);
    const receiptQty = getCumulativeReceiptQtyByOrder(orderNo);
    const invoiceCost = getCumulativeInvoiceCostByOrder(orderNo);
    const receiptCost = getCumulativeReceiptCostByOrder(orderNo);
    
    return invoiceQty !== receiptQty || invoiceCost !== receiptCost;
  };

  // Helper functions for multi-invoice matching
  const getSelectedInvoices = () => {
    return invoices.filter(inv => selectedInvoiceIds.includes(inv.id));
  };

  const getCumulativeInvoiceQty = () => {
    return getSelectedInvoices().reduce((sum, inv) => {
      return sum + (inv.lines[0]?.invoiceQty || 0);
    }, 0);
  };

  const getCumulativeInvoiceCost = () => {
    return getSelectedInvoices().reduce((sum, inv) => {
      return sum + inv.amount;
    }, 0);
  };

  const getSelectedMultiReceiptsArray = () => {
    const allReceipts: Receipt[] = [];
    getSelectedInvoices().forEach(inv => {
      inv.receipts.forEach(receipt => {
        if (selectedMultiReceipts.has(receipt.receiptNo) && !allReceipts.find(r => r.receiptNo === receipt.receiptNo)) {
          allReceipts.push(receipt);
        }
      });
    });
    return allReceipts;
  };

  const getCumulativeReceiptQty = () => {
    return getSelectedMultiReceiptsArray().reduce((sum, receipt) => {
      return sum + (receipt?.quantity || 0);
    }, 0);
  };

  const getCumulativeReceiptCost = () => {
    return getSelectedMultiReceiptsArray().reduce((sum, receipt) => {
      return sum + (receipt?.amount || 0);
    }, 0);
  };

  const hasCumulativeVariance = () => {
    if (selectedInvoiceIds.length === 0) return false;
    if (getSelectedMultiReceiptsArray().length === 0) return false;
    
    const invoiceQty = getCumulativeInvoiceQty();
    const receiptQty = getCumulativeReceiptQty();
    const invoiceCost = getCumulativeInvoiceCost();
    const receiptCost = getCumulativeReceiptCost();
    
    return invoiceQty !== receiptQty || invoiceCost !== receiptCost;
  };

  const visibleInvoices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return invoices.filter(invoice => {
      const matchesQuery = !normalizedQuery || [invoice.invoiceNo, getSupplierSiteDisplay(invoice), invoice.orderNo, invoice.id]
        .some(value => value.toLowerCase().includes(normalizedQuery));
      const matchesFilter = filter === 'All invoices'
        || (filter === 'Exceptions' && invoice.hasException === true)
        || (filter === 'Needs action' && invoice.status === 'Ready to Match')
        || (filter === 'Matched' && invoice.status === 'Matched');
      return matchesQuery && matchesFilter;
    });
  }, [filter, invoices, query]);

  const columns: TableColumnsType<Invoice> = [
    {
      title: 'INVOICE / SUPPLIER / ORDER',
      key: 'invoice',
      render: (_, invoice) => (
        <div className="invoice-cell">
          <span className="invoice-number">{invoice.invoiceNo}</span>
          <span className="supplier-name">{getSupplierSiteDisplay(invoice)} · Order {invoice.orderNo}</span>
        </div>
      ),
    },
    {
      title: 'TYPE',
      dataIndex: 'type',
      key: 'type',
      width: 76,
      render: value => <span className={`type-code type-${String(value).toLowerCase().replaceAll(' ', '-')}`}>{value}</span>,
    },
    {
      title: 'AMOUNT',
      key: 'amount',
      width: 112,
      align: 'right',
      render: (_, invoice) => <span className="amount-text">{money(invoice.amount, invoice.currency)}</span>,
    },
    {
      title: 'SAVED INVOICE STATUS',
      dataIndex: 'status',
      key: 'status',
      width: 148,
      render: (status: InvoiceStatus) => <Tag color={statusColor[status]}>{status}</Tag>,
    },
  ];

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedId(invoice.id);
    setActiveTab('matching');
    setLocalRuleApplied(false);
    setTaxBreakdownOpen(false);
  };

  const handleMatch = () => {
    if (selectedInvoice.status !== 'Ready to Match' || isNoteMemo(selectedInvoice.type)) {
      messageApi.warning('Only invoices ready to match can be confirmed.');
      return;
    }
    if (hasConfiguredVariance && hasLineVariance && !varianceWithinTolerance) {
      messageApi.warning('Matching is on hold until the Concept team resolves the above-tolerance variance.');
      return;
    }
    if (hasConfiguredVariance && hasLineVariance && !selectedInvoice.varianceCorrectionApplied) {
      messageApi.warning('Apply the lower quantity and cost before matching this invoice.');
      return;
    }
    if (selectedInvoice.type !== 'Local' && !isNoteMemo(selectedInvoice.type) && selectedInvoice.receipts.length > 1 && (!selectedReceipts[selectedId] || selectedReceipts[selectedId].length === 0)) {
      messageApi.warning('Select the exact receipt number before matching this invoice.');
      return;
    }
    if (selectedInvoice.type === 'Local' && !localRuleApplied && selectedInvoice.tolerance > 0) {
      messageApi.warning('Apply the in-tolerance quantity or cost rule before matching.');
      return;
    }
    const matchedAt = new Date().toISOString();
    setInvoices(current => current.map(invoice => invoice.id === selectedId && invoice.status === 'Ready to Match' ? { ...invoice, status: 'Matched', matchedAt, hasException: false } : invoice));
    messageApi.success('ReIM match recorded. Downstream status updates run through backend integrations.');
  };

  const handleApplyLowerValues = () => {
    if (selectedInvoice.status !== 'Ready to Match') {
      messageApi.warning('Matched or posted invoices cannot be changed.');
      return;
    }
    const correctedLines = selectedInvoice.lines.map(line => ({
      ...line,
      invoiceQty: Math.min(line.invoiceQty, line.receiptQty),
      unitCost: line.receiptUnitCost === undefined ? line.unitCost : Math.min(line.unitCost, line.receiptUnitCost),
    }));
    const correctedAmount = correctedLines.reduce((total, line) => total + line.invoiceQty * line.unitCost, 0);
    setInvoices(current => current.map(invoice => invoice.id === selectedId ? {
      ...invoice,
      lines: correctedLines,
      amount: Number(correctedAmount.toFixed(2)),
      status: 'Ready to Match',
      varianceCorrectionApplied: true,
    } : invoice));
    messageApi.success('Lower invoice quantity and cost applied.');
  };

  const handleConceptEscalation = () => {
    setInvoices(current => current.map(invoice => invoice.id === selectedId ? { ...invoice, conceptEscalated: true } : invoice));
    messageApi.success('Above-tolerance variance recorded for Concept team resolution.');
  };

  const openDiscrepancyResolution = (orderNo: string) => {
    const invoiceIds = selectedInvoicesByOrder[orderNo] || [];
    const receiptNos = selectedReceiptsByOrder[orderNo] || [];
    const invoice = invoices.find(item => item.orderNo === orderNo && item.id === invoiceIds[0]);
    const receipt = getReceiptsForOrder(orderNo).find(item => item.receiptNo === receiptNos[0]);
    if (!invoice || !receipt) {
      messageApi.warning('Select an invoice and receipt before resolving a discrepancy.');
      return;
    }
    const savedResolution = getCurrentOrderResolution(orderNo);
    setQuantityResolution(savedResolution ? { ...savedResolution.quantity } : {});
    setCostResolution(savedResolution ? { ...savedResolution.cost } : {});
    setResolutionTarget({ orderNo, invoiceId: invoice.id, receiptNo: receipt.receiptNo, lineIndex: 0 });
    setResolveDiscrepancyOpen(true);
  };

  const handleApplyDiscrepancyResolution = () => {
    if (!resolutionTarget || !resolutionInvoice || !resolutionReceipt || (!resolutionIsAggregate && (!resolutionLine || resolutionReceiptCost === undefined))) {
      messageApi.warning('Select a valid invoice item and receipt.');
      return;
    }
    const orderNo = resolutionTarget.orderNo;
    const originalInvoiceQty = activeOrderResolution?.originalInvoiceQty ?? getCumulativeInvoiceQtyByOrder(orderNo);
    const originalReceiptQty = activeOrderResolution?.originalReceiptQty ?? getCumulativeReceiptQtyByOrder(orderNo);
    const originalInvoiceCost = activeOrderResolution?.originalInvoiceCost ?? getCumulativeInvoiceCostByOrder(orderNo);
    const originalReceiptCost = activeOrderResolution?.originalReceiptCost ?? getCumulativeReceiptCostByOrder(orderNo);
    const quantityDiffers = originalInvoiceQty !== originalReceiptQty;
    const costDiffers = costResolutionRequired(resolutionIsAggregate, originalInvoiceCost,
      originalReceiptCost, resolutionLine?.unitCost, originalReceiptQty);
    if (costDiffers === undefined) {
      messageApi.warning('Select a valid invoice item and receipt.');
      return;
    }
    if ((quantityDiffers && !quantityResolution.type) || (costDiffers && !costResolution.type)) {
      messageApi.warning('Choose a resolution for each quantity or cost discrepancy.');
      return;
    }

    const updatedInvoices = invoices.map(invoice => {
      if (resolutionIsAggregate || invoice.id !== resolutionTarget.invoiceId) return invoice;
      const line = invoice.lines[resolutionTarget.lineIndex];
      if (!line || !resolutionLine) return invoice;
      const updatedLine = {
        ...line,
        invoiceQty: resolutionQtyMismatch
          ? (quantityResolution.type === 'receipt' ? resolutionReceipt.quantity : resolutionLine.invoiceQty)
          : line.invoiceQty,
        unitCost: resolutionCostMismatch
          ? (costResolution.type === 'receipt' && resolutionReceiptCost !== undefined ? resolutionReceiptCost : resolutionLine.unitCost)
          : line.unitCost,
      };
      return {
        ...invoice,
        quantityResolution: quantityResolution.type ? { ...quantityResolution, type: quantityResolution.type } : invoice.quantityResolution,
        costResolution: costResolution.type ? { ...costResolution, type: costResolution.type } : invoice.costResolution,
        lines: invoice.lines.map((item, index) => index === resolutionTarget.lineIndex ? updatedLine : item),
        amount: updatedLine.invoiceQty === line.invoiceQty && updatedLine.unitCost === line.unitCost
          ? invoice.amount
          : Number((invoice.amount + updatedLine.invoiceQty * updatedLine.unitCost - line.invoiceQty * line.unitCost).toFixed(2)),
      };
    });
    setInvoices(updatedInvoices);
    setOrderResolutions(current => ({
      ...current,
      [orderNo]: {
        snapshot: getResolutionSnapshot(orderNo, updatedInvoices),
        isAggregate: resolutionIsAggregate,
        quantity: quantityResolution,
        cost: costResolution,
        originalInvoice: activeOrderResolution?.originalInvoice ?? (resolutionIsAggregate ? undefined : resolutionInvoice),
        originalInvoiceQty,
        originalReceiptQty,
        originalInvoiceCost,
        originalReceiptCost,
      },
    }));

    setResolveDiscrepancyOpen(false);
    if ((quantityDiffers && quantityResolution.type === 'defer') || (costDiffers && costResolution.type === 'defer')) {
      messageApi.info('Resolution deferred. Confirm Match remains unavailable while a discrepancy is deferred.');
    } else {
      messageApi.success('Resolution choices recorded.');
    }
  };

  const openReimCreate = () => {
    invoiceItemsReadId.current += 1;
    setPendingInvoiceItems(null);
    const today = localDateInputValue(new Date());
    const draft = { ...emptyInvoiceDraft, invoiceDate: today, dueDate: today, items: [createInvoiceDraftItem()] };
    createDraftBaseline.current = draft;
    setInvoiceDraft(draft);
    setDetailDraftBaseline(null);
    setEditingInvoice(false);
    detailInvoiceAtOpen.current = null;
    setTaxEditorOpen(false);
    setReimCreateOpen(true);
  };

  const openInvoiceDetails = (invoice: Invoice) => {
    if (isNoteMemo(invoice.type)) {
      setDetailInvoiceId(invoice.id);
      setInvoiceDetailOpen(true);
      return;
    }
    invoiceItemsReadId.current += 1;
    setPendingInvoiceItems(null);
    const draft = invoiceToDraft(invoice);
    detailInvoiceAtOpen.current = invoice;
    setDetailInvoiceId(invoice.id);
    setInvoiceDraft(draft);
    setDetailDraftBaseline(draft);
    setEditingInvoice(false);
    setTaxEditorOpen(false);
    setReimCreateOpen(true);
  };

  const closeReimCreate = () => {
    if (savingInvoice) return;
    invoiceItemsReadId.current += 1;
    setPendingInvoiceItems(null);
    setTaxEditorOpen(false);
    setDiscardInvoiceDraftOpen(false);
    createDraftBaseline.current = null;
    setReimCreateOpen(false);
  };

  const requestCloseReimCreate = () => {
    if (savingInvoice) return;
    if (!detailDraftBaseline && createDraftBaseline.current
      && JSON.stringify(invoiceDraft) !== JSON.stringify(createDraftBaseline.current)) {
      setDiscardInvoiceDraftOpen(true);
      return;
    }
    closeReimCreate();
  };

  const downloadInvoiceItems = () => {
    const result = exportInvoiceItemsCsv(invoiceDraft.items);
    if ('error' in result) {
      messageApi.error(result.error);
      return;
    }
    const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'invoice-items.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const uploadInvoiceItems = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const readId = ++invoiceItemsReadId.current;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      messageApi.error('Choose a CSV file.');
      return;
    }
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    } catch {
      if (readId === invoiceItemsReadId.current) messageApi.error('Unable to read the file. Choose a UTF-8 CSV file.');
      return;
    }
    if (readId !== invoiceItemsReadId.current) return;
    const result = importInvoiceItemsCsv(text);
    if ('error' in result) {
      messageApi.error(result.error);
      return;
    }
    setPendingInvoiceItems(result.items);
  };

  const updateInvoiceDraftItem = (id: string, changes: Partial<Omit<InvoiceDraftItem, 'id'>>) => {
    setInvoiceDraft(current => ({
      ...current,
      items: current.items.map(item => item.id === id ? { ...item, ...changes } : item),
    }));
  };

  const openCreditNoteCreate = () => {
    setCreditNoteDraft(emptyCreditNoteDraft);
    setCreditNoteCreateOpen(true);
  };

  const handleCreateCreditNote = () => {
    const orderInvoice = invoices.find(invoice => invoice.id === creditNoteDraft.orderInvoiceId);
    const documentNo = creditNoteDraft.documentNo.trim();
    const amount = creditNoteDraft.amount;
    if (!orderInvoice || !documentNo || !creditNoteDraft.documentDate) {
      messageApi.warning('Select an order and enter the document number and date.');
      return;
    }
    if (amount === null || !Number.isFinite(amount) || amount < 0.01) {
      messageApi.warning('Enter a document amount of at least 0.01.');
      return;
    }
    const duplicate = invoices.some(invoice =>
      invoice.type === creditNoteDraft.documentType
      && (orderInvoice.vendorCode ? invoice.vendorCode === orderInvoice.vendorCode : invoice.vendor.toLowerCase() === orderInvoice.vendor.toLowerCase())
      && invoice.invoiceNo.toLowerCase() === documentNo.toLowerCase(),
    );
    if (duplicate) {
      messageApi.warning('A document of this type with this number already exists for the supplier.');
      return;
    }
    const newCreditNote: Invoice = {
      id: `DOC-${Date.now()}`,
      invoiceNo: documentNo,
      vendor: orderInvoice.vendor,
      vendorCode: orderInvoice.vendorCode,
      supplierSiteNo: getSupplierSiteNumber(orderInvoice),
      supplierSiteName: orderInvoice.supplierSiteName,
      type: creditNoteDraft.documentType,
      orderNo: orderInvoice.orderNo,
      invoiceDate: new Date(`${creditNoteDraft.documentDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      ageDays: 0,
      amount: Number(amount.toFixed(2)) * (creditNoteDraft.documentType === 'Credit note' ? -1 : 1),
      currency: orderInvoice.currency,
      status: creditNoteDraft.documentType === 'Credit Note Request - Quantity' ? 'Approved' : 'Posted',
      source: `Simulated ReIM ${noteMemoTypeLabel(creditNoteDraft.documentType)}`,
      initials: orderInvoice.initials,
      receipts: [],
      lines: [],
      taxResolved: true,
      tolerance: 0,
      noteMemoDetails: {
        location: creditNoteDraft.location.trim(),
        requestReference: creditNoteDraft.requestReference.trim(),
        comment: creditNoteDraft.comment.trim(),
      },
    };
    setInvoices(current => [...current, newCreditNote]);
    setOrderFilter(orderInvoice.orderNo);
    setSupplierSiteFilter('');
    setDocumentFilter('');
    setStatusFilter('');
    setOrderPage(1);
    setCreditNoteCreateOpen(false);
    messageApi.success(`${noteMemoTypeLabel(creditNoteDraft.documentType)} added to the prototype. No live document was created.`);
  };

  const handleCreateReimInvoice = () => {
    const itemError = validateInvoiceItems(invoiceDraft.items);
    const itemTotals = getInvoiceItemTotals(invoiceDraft.items);
    if (invoiceDraft.nonMerchCostExTax === null || invoiceDraft.taxRate === null || invoiceDraft.allowances === null) {
      messageApi.warning('Enter non-merchandise cost and allowances, and select a tax code.');
      return;
    }
    const totalExTax = itemTotals.merchandiseCost + invoiceDraft.nonMerchCostExTax;
    const taxCost = Number((totalExTax * invoiceDraft.taxRate / 100).toFixed(2));
    const invoiceAmount = Number((totalExTax + taxCost - invoiceDraft.allowances).toFixed(2));
    const missingFields = [
      !invoiceDraft.invoiceNo.trim() && 'invoice number',
      !invoiceDraft.supplierSite.trim() && 'supplier site number',
      !invoiceDraft.supplierSiteName.trim() && 'supplier site name',
      !invoiceDraft.orderNo.trim() && 'order number',
      !invoiceDraft.invoiceDate && 'invoice date',
    ].filter(Boolean);
    if (missingFields.length) {
      messageApi.warning(`Complete the required fields: ${missingFields.join(', ')}.`);
      return;
    }
    if (invoiceNumberExists(invoices, invoiceDraft.invoiceNo, invoiceDraft.supplierSite)) {
      messageApi.warning('This invoice number already exists for the supplier site.');
      return;
    }
    if (itemError) {
      messageApi.warning(itemError);
      return;
    }
    const items = invoiceDraft.items.filter(
      (item): item is InvoiceDraftItem & { quantity: number; unitCost: number } =>
        item.quantity !== null && item.unitCost !== null,
    );
    if (items.length !== invoiceDraft.items.length) {
      messageApi.error('Invoice item details are incomplete.');
      return;
    }
    if (!Number.isFinite(totalExTax) || !Number.isFinite(invoiceAmount) || totalExTax <= 0 || invoiceAmount <= 0) {
      messageApi.warning('Enter a positive cost and invoice quantity before creating the invoice.');
      return;
    }
    const newInvoice: Invoice = {
      id: `IM-${Date.now()}`,
      invoiceNo: invoiceDraft.invoiceNo.trim(),
      vendor: invoiceDraft.supplierSiteName.trim(),
      vendorCode: '',
      supplierSiteNo: invoiceDraft.supplierSite.trim(),
      supplierSiteName: invoiceDraft.supplierSiteName.trim(),
      type: invoiceDraft.type,
      orderNo: invoiceDraft.orderNo.trim(),
      invoiceDate: new Date(`${invoiceDraft.invoiceDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      ageDays: 0,
      amount: invoiceAmount,
      currency: invoiceDraft.currency,
      status: 'Ready to Match',
      source: 'Created in ReIM',
      initials: invoiceDraft.supplierSiteName.trim().slice(0, 2).toUpperCase(),
      receipts: [],
      lines: items.map(item => ({
        item: item.item.trim(),
        description: item.description.trim(),
        invoiceQty: item.quantity,
        receiptQty: 0,
        unitCost: item.unitCost,
        tax: `${invoiceDraft.taxRate}%`,
      })),
      taxResolved: true,
      tolerance: 0,
      maintenance: invoiceDraft,
    };
    setInvoices(current => [newInvoice, ...current]);
    setOrderPage(1);
    setSelectedId(newInvoice.id);
    setActiveTab('matching');
    setLocalRuleApplied(false);
    closeReimCreate();
    messageApi.success('Invoice created in ReIM and added to the matching queue.');
  };

  const handleSaveInvoice = async () => {
    const original = detailInvoiceAtOpen.current;
    if (!original || !detailDraftBaseline || savingInvoice) return;
    const financialChanged = invoiceFinancialsChanged(detailDraftBaseline, invoiceDraft);
    const itemsChanged = JSON.stringify(detailDraftBaseline.items) !== JSON.stringify(invoiceDraft.items);
    const missingFields = [
      !invoiceDraft.invoiceNo.trim() && 'invoice number',
      !invoiceDraft.supplierSite.trim() && 'supplier site number',
      !invoiceDraft.supplierSiteName.trim() && 'supplier site name',
      !invoiceDraft.invoiceDate && 'invoice date',
    ].filter(Boolean);
    if (missingFields.length) {
      messageApi.warning(`Complete the required fields: ${missingFields.join(', ')}.`);
      return;
    }
    const itemError = itemsChanged || financialChanged ? validateInvoiceItems(invoiceDraft.items) : undefined;
    if (itemError) {
      messageApi.warning(itemError);
      return;
    }
    if (financialChanged && (invoiceDraft.nonMerchCostExTax === null || invoiceDraft.allowances === null || invoiceDraft.taxRate === null)) {
      messageApi.warning('Enter non-merchandise cost and allowances, and select a tax code to recalculate the invoice total.');
      return;
    }
    const itemTotals = getInvoiceItemTotals(invoiceDraft.items);
    const exTax = itemTotals.merchandiseCost + (invoiceDraft.nonMerchCostExTax ?? 0);
    const amount = Number((exTax + Number((exTax * (invoiceDraft.taxRate ?? 0) / 100).toFixed(2)) - (invoiceDraft.allowances ?? 0)).toFixed(2));
    if (financialChanged && (!Number.isFinite(amount) || exTax <= 0 || amount <= 0)) {
      messageApi.warning('Enter a positive cost and invoice quantity before saving.');
      return;
    }
    setSavingInvoice(true);
    try {
      const state = await matchSession.getMatches();
      updateMatchState(state);
      const current = invoicesRef.current.find(invoice => invoice.id === original.id);
      if (!current || current.status !== 'Ready to Match' || state.matches.some(match => match.invoiceIds.includes(original.id))) {
        messageApi.warning('This invoice is matched or no longer available and cannot be edited.');
        const savedDraft = current ? invoiceToDraft(current) : detailDraftBaseline;
        setInvoiceDraft(savedDraft);
        setDetailDraftBaseline(savedDraft);
        setEditingInvoice(false);
        return;
      }
      if (current !== original) {
        messageApi.warning('This invoice changed while you were editing. Close and reopen its details.');
        return;
      }
      if (invoiceNumberExists(invoicesRef.current, invoiceDraft.invoiceNo, invoiceDraft.supplierSite, current.id)) {
        messageApi.warning('This invoice number already exists for the supplier site.');
        return;
      }
      if (JSON.stringify(invoiceDraft) === JSON.stringify(detailDraftBaseline)) {
        setEditingInvoice(false);
        messageApi.info('No changes to save.');
        return;
      }
      const lines = itemsChanged || invoiceDraft.taxRate !== detailDraftBaseline.taxRate
        ? reconcileInvoiceLines(detailDraftBaseline.items, current.lines, invoiceDraft.items, (item, previous) => ({
          item: item.item.trim(),
          description: item.description.trim(),
          invoiceQty: item.quantity ?? 0,
          receiptQty: previous?.receiptQty ?? 0,
          unitCost: item.unitCost ?? 0,
          receiptUnitCost: previous?.receiptUnitCost,
          tax: invoiceDraft.taxRate !== detailDraftBaseline.taxRate ? `${invoiceDraft.taxRate}%` : previous?.tax ?? (invoiceDraft.taxRate === null ? '' : `${invoiceDraft.taxRate}%`),
        }))
        : current.lines;
      const updated: Invoice = {
        ...current,
        invoiceNo: invoiceDraft.invoiceNo.trim(),
        supplierSiteNo: invoiceDraft.supplierSite.trim(),
        supplierSiteName: invoiceDraft.supplierSiteName.trim(),
        type: invoiceDraft.type,
        invoiceDate: new Date(`${invoiceDraft.invoiceDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        currency: invoiceDraft.currency,
        amount: financialChanged ? amount : current.amount,
        lines,
        maintenance: invoiceDraft,
        legacyDetails: current.legacyDetails ? {
          ...current.legacyDetails,
          groupId: invoiceDraft.groupId,
          supplierSite: invoiceDraft.supplierSite,
          location: invoiceDraft.location,
          dueDate: invoiceDraft.dueDate,
          invoiceTerms: invoiceDraft.invoiceTerms,
          orderTerms: invoiceDraft.orderTerms,
          supplierTerms: invoiceDraft.supplierTerms,
          exchangeRate: invoiceDraft.exchangeRate?.toString() ?? '',
          detailsAttached: invoiceDraft.detailsAttached ?? current.legacyDetails.detailsAttached,
          reference: invoiceDraft.refNo1,
          taxCode: invoiceDraft.taxCode,
          ...(financialChanged ? {
            costExTax: itemTotals.merchandiseCost,
            nonMerchCostExTax: invoiceDraft.nonMerchCostExTax ?? 0,
            taxCost: Number((exTax * (invoiceDraft.taxRate ?? 0) / 100).toFixed(2)),
            costIncTax: amount,
            invoiceQty: itemTotals.quantity,
            allowances: invoiceDraft.allowances ?? 0,
            taxCode: invoiceDraft.taxCode,
            taxRate: invoiceDraft.taxRate ?? 0,
          } : {}),
        } : undefined,
        quantityResolution: undefined,
        costResolution: undefined,
      };
      setInvoices(list => list.map(invoice => invoice.id === updated.id ? updated : invoice));
      setOrderResolutions(currentResolutions => {
        const next = { ...currentResolutions };
        delete next[current.orderNo];
        return next;
      });
      detailInvoiceAtOpen.current = updated;
      setDetailDraftBaseline(invoiceDraft);
      setEditingInvoice(false);
      messageApi.success('Invoice changes saved.');
    } catch (error) {
      messageApi.error(`Invoice was not saved: ${error instanceof Error ? error.message : 'Unable to reach the match service.'}`);
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleExport = () => {
    const rows = [['Invoice', 'Supplier site number', 'Supplier site name', 'Type', 'Order', 'Amount', 'Saved invoice status'], ...getFilteredOrders().flatMap(order => order.invoices).map(invoice => [
      invoice.invoiceNo, getSupplierSiteNumber(invoice), getSupplierSiteName(invoice), invoice.type, invoice.orderNo, String(invoice.amount), invoice.status,
    ])];
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'invoice-matching-queue.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openExceptionReport = (orderNo: string) => {
    setReportOrderNo(orderNo);
    setReportRecipients('');
    setReportReason('');
    setReportComment('');
    setReportOpen(true);
  };

  const handleExceptionReport = () => {
    const recipients = reportRecipients.split(';').map(address => address.trim()).filter(Boolean);
    if (!recipients.length || recipients.some(address => !/^[^\s@;]+@[^\s@;.]+(?:\.[^\s@;.]+)+$/.test(address)) || !reportReason.trim()) {
      messageApi.warning('Enter valid email addresses separated by semicolons and choose a reason.');
      return;
    }
    const timestamp = new Date().toLocaleString('en-AE');
    const report = {
      recipients,
      reason: reportReason,
      comment: reportComment,
      timestamp,
      invoiceIds: [...(selectedInvoicesByOrder[reportOrderNo] || [])],
      receiptNos: [...(selectedReceiptsByOrder[reportOrderNo] || [])],
    };
    setExceptionReports(current => ({
      ...current,
      [reportOrderNo]: [...(current[reportOrderNo] || []), report],
    }));
    setInvoices(current => current.map(invoice =>
      report.invoiceIds.includes(invoice.id) && invoice.status === 'Ready to Match' ? { ...invoice, hasException: true } : invoice
    ));
    setReportOpen(false);
    messageApi.success(`Exception report for Order #${reportOrderNo} recorded.`);
  };

  // PHASE 2 ENHANCEMENT: Handle OFIN posting simulation
  const handlePostToOfin = async (orderNo: string) => {
    const selectedInvoiceIds = [...(selectedInvoicesByOrder[orderNo] || [])];
    const receiptNos = [...(selectedReceiptsByOrder[orderNo] || [])];
    if (!matchState || matchServiceError) {
      messageApi.error('The match service is unavailable. Try again when it reconnects.');
      return;
    }
    if (!selectedInvoiceIds.length || !receiptNos.length) {
      messageApi.warning('Select an invoice and receipt before confirming the match.');
      return;
    }
    if (receiptNos.some(receiptNo => getReceiptMatch(orderNo, receiptNo))) {
      messageApi.warning('A selected receipt has already been matched. Select an available receipt.');
      return;
    }
    if (invoices.some(invoice => selectedInvoiceIds.includes(invoice.id) && invoice.status !== 'Ready to Match')) {
      messageApi.warning('Deselect matched or posted invoices before confirming another match.');
      return;
    }
    const status = getOrderMatchStatus(
      getCumulativeInvoiceQtyByOrder(orderNo),
      getCumulativeReceiptQtyByOrder(orderNo),
      getCumulativeInvoiceCostByOrder(orderNo),
      getCumulativeReceiptCostByOrder(orderNo),
    );
    if (status === 'exceeds-tolerance'
      || (status === 'within-tolerance' && !hasResolvedOrderVariance(orderNo))
      || (status === 'perfect' && getCurrentOrderResolution(orderNo) && !hasResolvedOrderVariance(orderNo))) {
      messageApi.warning('Resolve all discrepancies before confirming the match.');
      return;
    }
    const selectedInvoices = selectedInvoiceIds.map(id => invoices.find(invoice => invoice.id === id));
    if (selectedInvoices.some(invoice => !invoice)) {
      messageApi.error('A selected invoice is no longer available. Review the selection.');
      return;
    }
    const selectedReceipts = receiptNos.map(receiptNo => getReceiptsForOrder(orderNo).find(receipt => receipt.receiptNo === receiptNo));
    if (selectedReceipts.some(receipt => !receipt)) {
      messageApi.error('A selected receipt is no longer available. Review the selection.');
      return;
    }
    const selectedDocuments = selectedInvoices.filter((invoice): invoice is Invoice => !!invoice);
    const receiptDocuments = selectedReceipts.filter((receipt): receipt is Receipt => !!receipt);
    const currencies = new Set(selectedDocuments.map(invoice => invoice.currency));
    const receiptCurrencies = new Set(receiptDocuments.map(receipt => receipt.currency));
    const receiptAmount = receiptDocuments.reduce((sum, receipt) => sum + receipt.amount, 0);
    const savedResolution = getCurrentOrderResolution(orderNo);
    const details: MatchDetails = {
      invoiceNumbers: selectedDocuments.map(invoice => ({ id: invoice.id, number: invoice.invoiceNo })),
      currency: currencies.size === 1 ? selectedDocuments[0].currency : null,
      invoiceQty: savedResolution?.originalInvoiceQty ?? getCumulativeInvoiceQtyByOrder(orderNo),
      receiptQty: savedResolution?.originalReceiptQty ?? getCumulativeReceiptQtyByOrder(orderNo),
      invoiceCost: savedResolution?.originalInvoiceCost ?? getCumulativeInvoiceCostByOrder(orderNo),
      receiptCost: savedResolution?.originalReceiptCost ?? getCumulativeReceiptCostByOrder(orderNo),
      finalInvoiceQty: getCumulativeInvoiceQtyByOrder(orderNo),
      finalInvoiceCost: getCumulativeInvoiceCostByOrder(orderNo),
      quantityResolution: savedResolution?.quantity ?? {},
      costResolution: savedResolution?.cost ?? {},
      costResolutionScope: savedResolution
        ? (savedResolution.isAggregate ? 'aggregate' : 'unit')
        : (selectedDocuments.length !== 1 || receiptNos.length !== 1 || selectedDocuments[0].lines.length !== 1
          || Math.round(selectedDocuments[0].amount * 100) !== Math.round(selectedDocuments[0].lines[0].invoiceQty * selectedDocuments[0].lines[0].unitCost * 100)
          ? 'aggregate' : 'unit'),
    };
    const matchedTotals = getMatchedTotals(details, savedResolution?.isAggregate ? 'aggregate' : 'unit');
    if (matchedTotals.quantity === undefined || matchedTotals.amount === undefined) {
      messageApi.error('Unable to determine matched totals. Review the resolution choices.');
      return;
    }
    const matchedAmount = matchedTotals.amount;
    const matchedQuantity = matchedTotals.quantity;
    details.matchedTotals = { quantity: matchedQuantity, amount: matchedAmount };
    setPostingOrderNo(orderNo);
    setPostingConfirmationOpen(false);
    
    try {
      const request = { orderNo, invoiceIds: selectedInvoiceIds, receiptNos, details };
      const { state: data, conflict } = await matchSession.saveMatch(request);
      if (conflict) {
        updateMatchState(data);
        messageApi.warning('An invoice or receipt was already matched. Review the updated selection.');
        return;
      }
      updateMatchState(data);
      setMatchServiceError('');
      const now = new Date();
      const timestamp = now.toLocaleString('en-AE');
      setOffinPostings(current => ({
        ...current,
        [orderNo]: {
          status: 'Scheduled',
          referenceNumber: `OFIN-${Date.now()}`,
          currency: details.currency,
          receiptCurrency: receiptCurrencies.size === 1 ? receiptDocuments[0].currency : null,
          invoiceNumbers: details.invoiceNumbers.map(invoice => invoice.number),
          receiptNos,
          matchedQuantity,
          matchedAmount,
          lineItems: getFinancePostingLines(receiptAmount, now),
          timestamp
        }
      }));
      setPostingConfirmationOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to reach the match service.';
      setMatchServiceError(errorMessage);
      messageApi.error(`Match was not confirmed: ${errorMessage}`);
    }
  };

  const today = new Date().toDateString();
  const readyToMatch = invoices.filter(invoice => !isNoteMemo(invoice.type) && invoice.status === 'Ready to Match').length;
  const matchedToday = invoices.filter(invoice => !isNoteMemo(invoice.type)
    && (invoice.status === 'Matched' || invoice.status === 'Posted')
    && invoice.matchedAt && new Date(invoice.matchedAt).toDateString() === today).length;
  const pendingInvoices = readyToMatch + matchedToday;
  const unpostedNotesAndMemos = invoices.filter(invoice => isNoteMemo(invoice.type) && invoice.status !== 'Posted').length;

  const clearWorkbenchFilters = () => {
    setOrderFilter('');
    setSupplierSiteFilter('');
    setDocumentFilter('');
    setStatusFilter('');
    setOrderPage(1);
  };

  const handleNav = (key: string) => {
    if (key !== 'matching') return;
    clearWorkbenchFilters();
    setOrderPageSize(10);
    setActiveTab('matching');
    window.scrollTo({ top: 0 });
  };

  // Check if any selected receipt has variance
  const hasVarianceInSelectedReceipts = () => {
    if (!selectedId || !selectedReceipts[selectedId] || selectedReceipts[selectedId].length === 0) {
      return false;
    }
    
    return selectedReceipts[selectedId].some(receiptNo => {
      const receipt = selectedInvoice.receipts.find(r => r.receiptNo === receiptNo);
      if (!receipt) return false;
      
      const invoiceQty = selectedInvoice.lines[0]?.invoiceQty || 0;
      const receiptQty = receipt.quantity;
      const qtyMismatch = invoiceQty !== receiptQty;
      
      const invoiceCost = selectedInvoice.lines[0]?.unitCost || 0;
      const receiptUnitCost = receipt.amount / receipt.quantity;
      const costMismatch = invoiceCost !== receiptUnitCost;
      
      return qtyMismatch || costMismatch;
    });
  };

  // Detect if cost variance exists between selected invoice and receipt
  const hasCostVariance = () => {
    if (!selectedId || !selectedReceipts[selectedId] || selectedReceipts[selectedId].length === 0) return false;
    const receiptNo = selectedReceipts[selectedId][0];
    const receipt = selectedInvoice.receipts.find(r => r.receiptNo === receiptNo);
    if (!receipt) return false;
    const receiptUnitCost = receipt.amount / receipt.quantity;
    return selectedInvoice.lines.some(line => {
      return line.unitCost !== receiptUnitCost;
    });
  };

  // Detect if quantity variance exists
  const hasQuantityVariance = () => {
    if (!selectedId || !selectedReceipts[selectedId] || selectedReceipts[selectedId].length === 0) return false;
    const receiptNo = selectedReceipts[selectedId][0];
    const receipt = selectedInvoice.receipts.find(r => r.receiptNo === receiptNo);
    if (!receipt) return false;
    return selectedInvoice.lines.some(line => {
      return line.invoiceQty !== receipt.quantity;
    });
  };

  // Get receipt data for comparison (uses first selected receipt)
  // Removed getSelectedReceipt - now using selectedReceipt instead

  const hasConfiguredVariance = selectedInvoice.quantityTolerance !== undefined || selectedInvoice.costTolerance !== undefined;
  const hasLineVariance = selectedInvoice.lines.some(line => line.invoiceQty !== line.receiptQty
    || (line.receiptUnitCost !== undefined && line.unitCost !== line.receiptUnitCost));
  const varianceWithinTolerance = hasConfiguredVariance && hasLineVariance && selectedInvoice.lines.every(line =>
    Math.abs(line.invoiceQty - line.receiptQty) <= (selectedInvoice.quantityTolerance ?? 0)
      && Math.abs(line.unitCost - (line.receiptUnitCost ?? line.unitCost)) <= (selectedInvoice.costTolerance ?? 0),
  );
  const maxQuantityVariance = Math.max(0, ...selectedInvoice.lines.map(line => Math.abs(line.invoiceQty - line.receiptQty)));
  const maxUnitCostVariance = Math.max(0, ...selectedInvoice.lines.map(line => Math.abs(line.unitCost - (line.receiptUnitCost ?? line.unitCost))));
  const matchDisabled = selectedInvoice.status !== 'Ready to Match'
    || isNoteMemo(selectedInvoice.type)
    || selectedInvoice.manualCreation === true
    || selectedInvoice.reimCreationEligible === true
    || (hasConfiguredVariance && hasLineVariance && (!varianceWithinTolerance || !selectedInvoice.varianceCorrectionApplied))
    || (selectedInvoice.type === 'CDC' && selectedInvoice.ageDays > 7 && selectedInvoice.receipts.length === 0)
    || (selectedInvoice.receipts.length > 1 && (!selectedReceipts[selectedId] || selectedReceipts[selectedId].length === 0))
    || (selectedInvoice.type === 'Local' && !selectedInvoice.taxResolved)
    || (selectedInvoice.type === 'Local' && selectedInvoice.tolerance > 0 && !localRuleApplied);
  const parsedInvoiceTaxRate = Number.parseFloat(selectedInvoice.lines[0]?.tax ?? '0') || 0;
  const invoiceTaxRate = selectedInvoice.legacyDetails?.taxRate ?? parsedInvoiceTaxRate;
  const invoiceCostExTax = selectedInvoice.legacyDetails?.costExTax
    ?? Number((selectedInvoice.amount / (1 + invoiceTaxRate / 100)).toFixed(2));
  const nonMerchCostExTax = selectedInvoice.legacyDetails?.nonMerchCostExTax ?? 0;
  const invoiceTotalExTax = invoiceCostExTax + nonMerchCostExTax;
  const invoiceTaxCost = selectedInvoice.legacyDetails?.taxCost
    ?? Number((selectedInvoice.amount - invoiceTotalExTax).toFixed(2));
  const invoiceLocation = selectedInvoice.legacyDetails?.location
    ?? selectedInvoice.receipts[0]?.location
    ?? 'Not available';
  const invoiceDocumentType = selectedInvoice.legacyDetails?.documentType
    ?? (isNoteMemo(selectedInvoice.type) ? noteMemoTypeLabel(selectedInvoice.type) : 'Merchandise Invoice');
  const draftItemTotals = getInvoiceItemTotals(invoiceDraft.items);
  const detailInvoice = detailDraftBaseline ? invoices.find(invoice => invoice.id === detailInvoiceId) : undefined;
  const detailReadOnly = !!detailDraftBaseline && !editingInvoice;
  const financialChanged = detailDraftBaseline ? invoiceFinancialsChanged(detailDraftBaseline, invoiceDraft) : true;
  const totalExTax = invoiceDraft.nonMerchCostExTax === null ? null : draftItemTotals.merchandiseCost + invoiceDraft.nonMerchCostExTax;
  const draftTaxCost = totalExTax === null || invoiceDraft.taxRate === null ? null : Number((totalExTax * invoiceDraft.taxRate / 100).toFixed(2));
  const totalInvoiceCost = totalExTax === null || draftTaxCost === null || invoiceDraft.allowances === null
    ? null : Number((totalExTax + draftTaxCost - invoiceDraft.allowances).toFixed(2));
  useEffect(() => {
    if (!editingInvoice || !detailInvoice || !detailDraftBaseline) return;
    if (detailInvoice.status === 'Ready to Match' && !matchState?.matches.some(match => match.invoiceIds.includes(detailInvoice.id))) return;
    const savedDraft = invoiceToDraft(detailInvoice);
    invoiceItemsReadId.current += 1;
    setPendingInvoiceItems(null);
    setTaxEditorOpen(false);
    setInvoiceDraft(savedDraft);
    setDetailDraftBaseline(savedDraft);
    setEditingInvoice(false);
    messageApi.warning('This invoice is matched and can no longer be edited.');
  }, [editingInvoice, detailInvoice, detailDraftBaseline, matchState, messageApi]);
  const creditNoteOrder = invoices.find(invoice => invoice.id === creditNoteDraft.orderInvoiceId);
  const creditNoteOrderOptions: { value: string; label: string }[] = [];
  const creditNoteOrderKeys = new Set<string>();
  invoices.forEach(invoice => {
    const key = JSON.stringify([invoice.orderNo, getSupplierSiteNumber(invoice) || getSupplierSiteName(invoice)]);
    if (!creditNoteOrderKeys.has(key)) {
      creditNoteOrderKeys.add(key);
      creditNoteOrderOptions.push({ value: invoice.id, label: `${invoice.orderNo} · ${getSupplierSiteDisplay(invoice)}` });
    }
  });
  const filteredOrders = getFilteredOrders();
  const currentOrderPage = Math.min(orderPage, Math.max(1, Math.ceil(filteredOrders.length / orderPageSize)));
  const pageOrders = filteredOrders.slice((currentOrderPage - 1) * orderPageSize, currentOrderPage * orderPageSize);

  return (
    <Layout className="app-shell">
      {contextHolder}
      <Layout.Sider className="app-sider" width={264} theme="light" breakpoint="lg" collapsedWidth={0}>
        <div className="brand-lockup">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Landmark Group" />
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <Menu
          mode="inline"
          selectedKeys={['matching']}
          items={navigationItems}
          onClick={({ key }) => handleNav(key)}
          className="primary-menu"
        />
        <div className="sider-bottom">
          <Menu
            mode="inline"
            selectedKeys={[]}
            items={[{ key: 'settings', icon: <SettingOutlined />, label: 'Settings' }]}
            className="secondary-menu"
          />
        </div>
      </Layout.Sider>

      <Layout className="main-layout">
        <Layout.Header className="topbar">
          <Space size={18} className="topbar-actions">
            <Tooltip title="Notifications">
              <Badge dot color="#f0a12b" offset={[-4, 5]}>
                <Button aria-label="Notifications" type="text" shape="circle" icon={<BellOutlined />} />
              </Badge>
            </Tooltip>
            <button type="button" className="topbar-profile" onClick={() => messageApi.info('Signed in as Sindhur Kumar · AP Executive')}>
              <span><strong>Sindhur Kumar</strong><small>AP Executive</small></span>
              <DownOutlined />
            </button>
          </Space>
        </Layout.Header>

        <Layout.Content className="page-content">
          <div className="page-heading">
            <div>
              <Typography.Title level={3} className="page-title">Invoice matching</Typography.Title>
              <Typography.Text className="page-subtitle">Review invoice details, select receipts, and resolve exceptions.</Typography.Text>
            </div>
            <Space className="heading-actions" wrap>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreditNoteCreate}>Create Note/ Memo</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openReimCreate}>Create invoice</Button>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>Export queue</Button>
            </Space>
          </div>

          <div className="metrics-row">
            <Card className="metric-card"><Statistic title={<span title="Ready to Match plus Matched Today">Pending Invoices</span>} value={pendingInvoices} /></Card>
            <Card className="metric-card"><Statistic title={<span title="Count based on invoice status, not current selections">Invoices: Ready to Match</span>} value={readyToMatch} valueStyle={{ color: '#1677ff' }} /></Card>
            <Card className="metric-card"><Statistic title={<span title="Invoices matched today, based on the browser's local date">Invoices: Matched Today</span>} value={matchedToday} valueStyle={{ color: '#389e0d' }} /></Card>
            <Card className="metric-card"><Statistic title={<span title="Credit notes, requests and memos that are not posted">Unposted Notes, Requests &amp; Memos</span>} value={unpostedNotesAndMemos} valueStyle={{ color: '#d46b08' }} /></Card>
          </div>

          <div className="workbench-heading">
            <div className="workbench-title-wrap">
              <Typography.Title level={5} className="workbench-title">Matching workbench</Typography.Title>
            </div>
            <Button type="text" icon={<SyncOutlined />} onClick={() => window.location.reload()}>Refresh</Button>
          </div>

          {(!matchState || matchServiceError) && (
            <div role="alert" style={{marginBottom: 12, color: '#b42318'}}>
              {matchServiceError ? `Match service unavailable: ${matchServiceError} ` : 'Connecting to the match service. '}
              Receipt selection and match confirmation are unavailable until it connects.
            </div>
          )}

          <div className="workbench-filters">
            <div className="workbench-filters-grid">
              <div className="workbench-filter-field">
                <label htmlFor="filter-order">Order Number</label>
                <Input
                  id="filter-order"
                  placeholder="Search order number"
                  value={orderFilter}
                  onChange={(e) => { setOrderFilter(e.target.value); setOrderPage(1); }}
                  allowClear
                />
              </div>
              <div className="workbench-filter-field">
                <label htmlFor="filter-document">Document</label>
                <Input
                  id="filter-document"
                  placeholder="Search document number"
                  value={documentFilter}
                  onChange={(event) => { setDocumentFilter(event.target.value); setOrderPage(1); }}
                  allowClear
                />
              </div>
              <div className="workbench-filter-field">
                <label htmlFor="filter-supplier-site">Supplier Site</label>
                <Select
                  id="filter-supplier-site"
                  placeholder="All sites"
                  value={supplierSiteFilter || undefined}
                  onChange={(value) => { setSupplierSiteFilter(value ?? ''); setOrderPage(1); }}
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={getSupplierSites()}
                />
              </div>
              <div className="workbench-filter-field">
                <label htmlFor="filter-status">Invoice status</label>
                <Select
                  id="filter-status"
                  placeholder="All statuses"
                  value={statusFilter || undefined}
                  onChange={(value) => { setStatusFilter(value ?? ''); setOrderPage(1); }}
                  allowClear
                  options={getStatuses().map(status => ({label: status, value: status}))}
                />
              </div>
              <Button onClick={clearWorkbenchFilters}>
                Clear Filters
              </Button>
            </div>
          </div>

          {/* ORDER-BASED MATCHING PANELS */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            {pageOrders.map(order => {
              const completedMatches = (matchState?.matches ?? []).filter(match =>
                match.orderNo === order.orderNo && (
                  match.invoiceIds.some(id => order.invoices.some(invoice => invoice.id === id))
                  || (match.invoiceIds.every(id => !invoices.some(invoice => invoice.id === id))
                    && (!statusFilter || statusFilter === match.status))
                ),
              );
              const pendingInvoices = order.invoices.filter(invoice => !getInvoiceMatch(order.orderNo, invoice.id));
              const availableReceipts = getReceiptsForOrder(order.orderNo).filter(receipt => !getReceiptMatch(order.orderNo, receipt.receiptNo));
              return (
              <Card key={order.orderNo} className="order-card">
                  {/* ORDER HEADER */}
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f0f0f0'}}>
                    <div>
                      <Typography.Title level={4} style={{margin: 0}}>Order #{order.orderNo}</Typography.Title>
                      <Typography.Text type="secondary" style={{fontSize: 12}}>
                        {Array.from(new Set(order.invoices.map(getSupplierSiteDisplay))).join(' / ')}
                      </Typography.Text>
                    </div>
                    {order.invoices[0]?.exampleLabel && (
                      <Popover content={order.invoices[0].exampleLabel} trigger="click" placement="bottomRight">
                        <Button type="text" size="small" icon={<InfoCircleOutlined />} aria-label={`View scenario for order ${order.orderNo}`} />
                      </Popover>
                    )}
                  </div>

                  {(selectedInvoicesByOrder[order.orderNo] || []).some(id => !order.invoices.some(invoice => invoice.id === id)) && (
                    <div style={{marginBottom: 12, color: '#ad6800', fontSize: 12}}>
                      Some selected invoices are hidden by the current filters and are included in matching totals.{' '}
                      <Button type="link" size="small" style={{padding: 0}} onClick={() => {
                        clearOrderResolution(order.orderNo);
                        setSelectedInvoicesByOrder(current => ({
                          ...current,
                          [order.orderNo]: (current[order.orderNo] || []).filter(id => order.invoices.some(invoice => invoice.id === id)),
                        }));
                      }}>Clear hidden selections</Button>
                    </div>
                  )}

                  {completedMatches.length > 0 && (
                    <section className="completed-matches" aria-label={`Completed matches for order ${order.orderNo}`}>
                      <h4>Completed Matches</h4>
                      {completedMatches.map(match => (
                        <div className="completed-match" key={`${match.orderNo}-${match.invoiceIds[0]}`}>
                          <div className="completed-match-header">
                            <Tag color={statusColor[match.status]}>{match.status}</Tag>
                            <Button size="small" onClick={() => setMatchDetailsKey({ orderNo: match.orderNo, invoiceId: match.invoiceIds[0] })}
                              aria-label={`View match details for ${match.invoiceIds.map(id => getMatchInvoiceNumber(match, id)).join(', ')}`}>
                              View Match Details
                            </Button>
                          </div>
                          <div className="completed-match-columns">
                            <div>
                              <div className="completed-match-heading">Invoices</div>
                              {match.invoiceIds.map(id => {
                                const invoice = invoices.find(item => item.id === id);
                                return (
                                  <div className="completed-match-document" key={id}>
                                    <div>
                                      <strong>{getMatchInvoiceNumber(match, id)}</strong>
                                      {invoice ? (
                                        <>
                                          <div>{invoice.invoiceDate}</div>
                                          <div>
                                            {match.details && match.invoiceIds.length === 1
                                              ? match.details.finalInvoiceQty
                                              : invoice.lines.reduce((total, line) => total + line.invoiceQty, 0)} units ·{' '}
                                            {money(match.details && match.invoiceIds.length === 1 ? match.details.finalInvoiceCost : invoice.amount, invoice.currency)}
                                          </div>
                                        </>
                                      ) : <div>Invoice details unavailable in this browser</div>}
                                    </div>
                                    {invoice && <Button type="text" size="small" onClick={() => openInvoiceDetails(invoice)}>Details</Button>}
                                  </div>
                                );
                              })}
                            </div>
                            <div>
                              <div className="completed-match-heading">Receipts</div>
                              {match.receiptNos.map(receiptNo => {
                                const receipt = getReceiptsForOrder(order.orderNo).find(item => item.receiptNo === receiptNo);
                                return (
                                  <div className="completed-match-document" key={receiptNo}>
                                    <div>
                                      <strong>{receiptNo}</strong>
                                      {receipt ? (
                                        <>
                                          <div>{receipt.date}</div>
                                          <div>{receipt.quantity} units · {money(receipt.amount, receipt.currency)}</div>
                                        </>
                                      ) : <div>Receipt details unavailable in this browser</div>}
                                    </div>
                                    {receipt && <Button type="text" size="small" onClick={() => {
                                      setDetailReceiptKey({ orderNo: order.orderNo, receiptNo });
                                      setReceiptDetailOpen(true);
                                    }}>Details</Button>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {match.invoiceIds.length > 1 && <div className="completed-match-note">Matched as a group; individual allocations were not recorded.</div>}
                        </div>
                      ))}
                    </section>
                  )}

                  {/* TWO-COLUMN INVOICE/RECEIPT SELECTION */}
                  {pendingInvoices.length > 0 && (
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 16}}>
                    
                    {/* INVOICES COLUMN */}
                    <div>
                      <h4 style={{marginTop: 0, marginBottom: 12}}>Invoices ({pendingInvoices.length})</h4>
                      <div style={{border: '1px solid #f0f0f0', borderRadius: 4, padding: 12, maxHeight: 300, overflowY: 'auto'}}>
                        {pendingInvoices.map(inv => (
                          <label key={inv.id} style={{display: 'flex', gap: 8, padding: 8, borderRadius: 3, cursor: 'pointer', marginBottom: 4}}>
                            {!isNoteMemo(inv.type) && inv.status === 'Ready to Match' && <Checkbox
                              disabled={!matchState || !!matchServiceError}
                              checked={(selectedInvoicesByOrder[order.orderNo] || []).includes(inv.id)}
                              onChange={(e) => {
                                clearOrderResolution(order.orderNo);
                                setSelectedInvoicesByOrder(current => ({
                                  ...current,
                                  [order.orderNo]: e.target.checked
                                    ? [...(current[order.orderNo] || []), inv.id]
                                    : (current[order.orderNo] || []).filter(id => id !== inv.id)
                                }));
                              }}
                            />}
                            <div style={{flex: 1, minWidth: 0}}>
                              <div style={{fontWeight: 600, fontSize: 12}}>{inv.invoiceNo}</div>
                              <div style={{fontSize: 11, color: '#999', marginTop: 2}}>{inv.invoiceDate}</div>
                              <div style={{fontSize: 11, color: '#666', marginTop: 2}}>
                                {isNoteMemo(inv.type) ? `${noteMemoTypeLabel(inv.type)} · Not receipt matched` : `${inv.lines.reduce((total: number, line: InvoiceLine) => total + line.invoiceQty, 0)} units`} · {money(inv.amount, inv.currency)}
                              </div>
                              <div style={{fontSize: 11, marginTop: 4}}>
                                Status: <Tag color={statusColor[inv.status]}>{inv.status}</Tag>
                              </div>
                              {!isNoteMemo(inv.type) && inv.status !== 'Ready to Match' && (
                                <div style={{fontSize: 11, color: '#667082'}}>Match details unavailable.</div>
                              )}
                            </div>
                            <Button 
                              type="text" 
                              size="small" 
                              onClick={() => openInvoiceDetails(inv)}
                              style={{padding: '0 4px', minWidth: 'auto', height: 'auto', lineHeight: 1.2}}
                            >
                              Details
                            </Button>
                          </label>
                        ))}
                      </div>
                      {(selectedInvoicesByOrder[order.orderNo] || []).length > 0 && (
                        <div style={{marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 4, fontSize: 12}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                            <span>Total Qty:</span>
                            <strong>{getCumulativeInvoiceQtyByOrder(order.orderNo)} units</strong>
                          </div>
                          <div style={{display: 'flex', justifyContent: 'space-between'}}>
                            <span>Total Cost:</span>
                            <strong>{money(getCumulativeInvoiceCostByOrder(order.orderNo))}</strong>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RECEIPTS COLUMN */}
                    <div>
                      <h4 style={{marginTop: 0, marginBottom: 12}}>Receipts ({availableReceipts.length})</h4>
                      <div style={{border: '1px solid #f0f0f0', borderRadius: 4, padding: 12, maxHeight: 300, overflowY: 'auto'}}>
                        {availableReceipts.map(receipt => (
                          <label key={receipt.receiptNo} style={{display: 'flex', gap: 8, padding: 8, borderRadius: 3, cursor: 'pointer', marginBottom: 4}}>
                            <Checkbox
                              disabled={!matchState || !!matchServiceError}
                              checked={(selectedReceiptsByOrder[order.orderNo] || []).includes(receipt.receiptNo)}
                              onChange={(e) => {
                                clearOrderResolution(order.orderNo);
                                setSelectedReceiptsByOrder(current => ({
                                  ...current,
                                  [order.orderNo]: e.target.checked
                                    ? [...(current[order.orderNo] || []), receipt.receiptNo]
                                    : (current[order.orderNo] || []).filter(r => r !== receipt.receiptNo)
                                }));
                              }}
                            />
                            <div style={{flex: 1, minWidth: 0}}>
                              <div style={{fontWeight: 600, fontSize: 12}}>{receipt.receiptNo}</div>
                              <div style={{fontSize: 11, color: '#999', marginTop: 2}}>{receipt.date}</div>
                              <div style={{fontSize: 11, color: '#666', marginTop: 2}}>
                                {receipt.quantity} units · {money(receipt.amount, receipt.currency)}
                              </div>
                            </div>
                            <Button 
                              type="text" 
                              size="small"
                              onClick={() => {
                                setDetailReceiptKey({ orderNo: order.orderNo, receiptNo: receipt.receiptNo });
                                setReceiptDetailOpen(true);
                              }}
                              style={{padding: '0 4px', minWidth: 'auto', height: 'auto', lineHeight: 1.2}}
                            >
                              Details
                            </Button>
                          </label>
                        ))}
                      </div>
                      {(selectedReceiptsByOrder[order.orderNo] || []).length > 0 && (
                        <div style={{marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 4, fontSize: 12}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                            <span>Total Qty:</span>
                            <strong>{getCumulativeReceiptQtyByOrder(order.orderNo)} units</strong>
                          </div>
                          <div style={{display: 'flex', justifyContent: 'space-between'}}>
                            <span>Total Cost:</span>
                            <strong>{money(getCumulativeReceiptCostByOrder(order.orderNo))}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* VARIANCE SUMMARY AND ACTIONS - PHASE 1 ENHANCED */}
                  {(selectedInvoicesByOrder[order.orderNo] || []).length > 0 && (selectedReceiptsByOrder[order.orderNo] || []).length > 0 && (
                    <>
                      <Divider />
                      
                      {/* CALCULATE VARIANCE METRICS */}
                      {(() => {
                        const invoiceQty = getCumulativeInvoiceQtyByOrder(order.orderNo);
                        const receiptQty = getCumulativeReceiptQtyByOrder(order.orderNo);
                        const invoiceCost = getCumulativeInvoiceCostByOrder(order.orderNo);
                        const receiptCost = getCumulativeReceiptCostByOrder(order.orderNo);
                        
                        const qtyVariance = invoiceQty - receiptQty;
                        const costVariance = invoiceCost - receiptCost;
                        const qtyVariancePercent = formatVariancePercentage(qtyVariance, invoiceQty);
                        const costVariancePercent = formatVariancePercentage(costVariance, invoiceCost);
                        
                        const qtyExceeds = exceedsQuantityTolerance(qtyVariance, invoiceQty);
                        const costExceeds = exceedsCostTolerance(costVariance, invoiceCost);
                        const matchStatus = getOrderMatchStatus(invoiceQty, receiptQty, invoiceCost, receiptCost);
                        const selectedMatched = invoices.some(invoice =>
                          (selectedInvoicesByOrder[order.orderNo] || []).includes(invoice.id) && invoice.status !== 'Ready to Match'
                        );
                        const selectedReady = invoices.some(invoice =>
                          (selectedInvoicesByOrder[order.orderNo] || []).includes(invoice.id) && invoice.status === 'Ready to Match'
                        );
                        const savedResolution = getCurrentOrderResolution(order.orderNo);
                        const resolutionRecorded = !!savedResolution && matchStatus !== 'exceeds-tolerance' && hasResolvedOrderVariance(order.orderNo);
                        const resolutionRequired = (matchStatus === 'within-tolerance' || (matchStatus === 'perfect' && !!savedResolution))
                          && !resolutionRecorded;
                        const originalQtyVariance = savedResolution ? savedResolution.originalInvoiceQty - savedResolution.originalReceiptQty : qtyVariance;
                        const originalCostVariance = savedResolution ? savedResolution.originalInvoiceCost - savedResolution.originalReceiptCost : costVariance;
                        const selectedInvoiceIds = selectedInvoicesByOrder[order.orderNo] || [];
                        const selectedReceiptNos = selectedReceiptsByOrder[order.orderNo] || [];
                        const singleInvoice = selectedInvoiceIds.length === 1 ? invoices.find(invoice => invoice.id === selectedInvoiceIds[0]) : undefined;
                        const singleReceipt = selectedReceiptNos.length === 1 ? getReceiptsForOrder(order.orderNo).find(receipt => receipt.receiptNo === selectedReceiptNos[0]) : undefined;
                        const singleLine = singleInvoice?.lines.length === 1 ? singleInvoice.lines[0] : undefined;
                        const costVariesWithQuantity = !!singleInvoice && !!singleLine && !!singleReceipt && singleReceipt.quantity > 0
                          && Math.round(singleInvoice.amount * 100) === Math.round(singleLine.invoiceQty * singleLine.unitCost * 100)
                          && !unitCostsDiffer(singleLine.unitCost, singleReceipt.amount / singleReceipt.quantity);
                        const selectedItemDifferences = getItemNumberDifferences(
                          invoices.filter(invoice => (selectedInvoicesByOrder[order.orderNo] || []).includes(invoice.id))
                            .flatMap(invoice => invoice.lines.map(line => line.item)),
                          getReceiptsForOrder(order.orderNo).filter(receipt => (selectedReceiptsByOrder[order.orderNo] || []).includes(receipt.receiptNo))
                            .flatMap(receipt => receipt.items.map(item => item.item)),
                        );
                        
                        return (
                          <>
                            {(selectedItemDifferences.invoiceOnly.length > 0 || selectedItemDifferences.receiptOnly.length > 0) && (
                              <div role="alert" style={{marginBottom: 12, padding: 12, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6}}>
                                <strong>Item numbers differ across the selected invoices and receipts.</strong>
                                <div>Review the selected documents before matching. You can still proceed.</div>
                                {selectedItemDifferences.invoiceOnly.length > 0 && <div>Only on invoices: {selectedItemDifferences.invoiceOnly.join(', ')}</div>}
                                {selectedItemDifferences.receiptOnly.length > 0 && <div>Only on receipts: {selectedItemDifferences.receiptOnly.join(', ')}</div>}
                              </div>
                            )}
                            {/* TOLERANCE VISIBILITY */}
                            <div className="tolerance-display">
                              <div className="tolerance-section-title">Tolerance Settings</div>
                              <div className="tolerance-row">
                                <span className="tolerance-label">Quantity Tolerance:</span>
                                <span className="tolerance-value">±{DISCREPANCY_THRESHOLD_PCT}% ({Math.abs(invoiceQty * DISCREPANCY_THRESHOLD_PCT / 100).toFixed(2)} units)</span>
                              </div>
                              <div className="tolerance-row">
                                <span className="tolerance-label">Cost Tolerance:</span>
                                <span className="tolerance-value">±{DISCREPANCY_THRESHOLD_PCT}% ({money(Math.abs(invoiceCost * DISCREPANCY_THRESHOLD_PCT / 100))})</span>
                              </div>
                              
                              <div style={{marginTop: 8, paddingTop: 8, borderTop: '1px solid #e8eaed'}}>
                                <div className="tolerance-section-title" style={{marginBottom: 6}}>Current Variance</div>
                                <div className="tolerance-row">
                                  <span className="tolerance-label">Quantity:</span>
                                  <div className="tolerance-variance-detail">
                                    <span className={`tolerance-value ${qtyVariance === 0 ? 'tolerance-status-ok' : qtyExceeds ? 'tolerance-status-error' : 'tolerance-status-warning'}`}>
                                      {qtyVariance} units ({qtyVariancePercent}) {qtyVariance === 0 ? '✓' : qtyExceeds ? '✗' : '⚠'}
                                    </span>
                                    {savedResolution && originalQtyVariance !== qtyVariance && (
                                      <span>Original: {originalQtyVariance} units ({formatVariancePercentage(originalQtyVariance, savedResolution.originalInvoiceQty)})</span>
                                    )}
                                    {matchStatus !== 'exceeds-tolerance' && originalQtyVariance !== 0 && (
                                      <span className="tolerance-resolution">{selectedMatched
                                        ? (selectedReady ? 'Select unmatched invoices to resolve' : 'Variance in completed selection')
                                        : resolutionLabel(savedResolution?.quantity)}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="tolerance-row">
                                  <span className="tolerance-label">Cost:</span>
                                  <div className="tolerance-variance-detail">
                                    <span className={`tolerance-value ${costVariance === 0 ? 'tolerance-status-ok' : costExceeds ? 'tolerance-status-error' : 'tolerance-status-warning'}`}>
                                      {money(costVariance)} ({costVariancePercent}) {costVariance === 0 ? '✓' : costExceeds ? '✗' : '⚠'}
                                    </span>
                                    {savedResolution && originalCostVariance !== costVariance && (
                                      <span>Original: {money(originalCostVariance)} ({formatVariancePercentage(originalCostVariance, savedResolution.originalInvoiceCost)})</span>
                                    )}
                                    {matchStatus !== 'exceeds-tolerance' && originalCostVariance !== 0 && (
                                      <span className="tolerance-resolution">{selectedMatched
                                        ? (selectedReady ? 'Select unmatched invoices to resolve' : 'Variance in completed selection')
                                        : (savedResolution && !savedResolution.isAggregate && !savedResolution.cost.type) || (!savedResolution && costVariesWithQuantity)
                                          ? 'Amount varies with quantity'
                                          : resolutionLabel(savedResolution?.cost)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {(exceptionReports[order.orderNo] || []).map((report, index) => (
                              <div key={index} style={{marginTop: 12, padding: 12, background: '#f5f7fa', borderRadius: 6, fontSize: 12}}>
                                <strong style={{overflowWrap: 'anywhere'}}>Reported to {report.recipients.join('; ')}</strong> · {report.timestamp}
                                <div>Invoices: {report.invoiceIds.map(id => invoices.find(invoice => invoice.id === id)?.invoiceNo ?? id).join(', ')}</div>
                                <div>Receipts: {report.receiptNos.join(', ')}</div>
                                <div>Reason: {report.reason}</div>
                                {report.comment && <div>Comment: {report.comment}</div>}
                              </div>
                            ))}
                            
                            {/* ACTION BUTTONS */}
                            <Space style={{marginTop: 12}}>
                              {selectedMatched ? (
                                <span style={{color: '#667082', fontSize: 12}}>Deselect matched or posted invoices to confirm another match.</span>
                              ) : matchStatus === 'perfect' ? (
                                <>
                                  {savedResolution && (
                                    <Button onClick={() => openDiscrepancyResolution(order.orderNo)}>
                                      {resolutionRecorded ? 'Review Resolution' : 'Resolve Discrepancy'}
                                    </Button>
                                  )}
                                  <Button 
                                    type="primary"
                                    disabled={resolutionRequired || !matchState || !!matchServiceError}
                                    onClick={() => {
                                      handlePostToOfin(order.orderNo);
                                    }}
                                  >
                                    Confirm Match
                                  </Button>
                                </>
                              ) : matchStatus === 'within-tolerance' ? (
                                <>
                                  <Button 
                                    type="primary"
                                    onClick={() => openDiscrepancyResolution(order.orderNo)}
                                  >
                                    {resolutionRecorded ? 'Review Resolution' : 'Resolve Discrepancy'}
                                  </Button>
                                  <Button 
                                    disabled={!hasResolvedOrderVariance(order.orderNo) || !matchState || !!matchServiceError}
                                    onClick={() => {
                                      handlePostToOfin(order.orderNo);
                                    }}
                                  >
                                    Confirm Match
                                  </Button>
                                </>
                              ) : (
                                <Button type="primary" danger onClick={() => openExceptionReport(order.orderNo)}>
                                  Report Exception
                                </Button>
                              )}
                            </Space>
                            {resolutionRequired && !selectedMatched && (
                              <div style={{marginTop: 8, color: '#667082', fontSize: 12}}>
                                Resolve all discrepancies before confirming the match.
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                </Card>
              );
            })}
          </div>

          {filteredOrders.length === 0 && <div className="order-list-empty">No orders match the selected filters.</div>}
          <Pagination
            className="order-pagination"
            aria-label="Order pages"
            current={currentOrderPage}
            pageSize={orderPageSize}
            total={filteredOrders.length}
            showSizeChanger
            showTotal={(total, range) => total ? `${range[0]}–${range[1]} of ${total} orders` : '0 orders'}
            onChange={(page, pageSize) => {
              setOrderPage(pageSize === orderPageSize ? page : 1);
              setOrderPageSize(pageSize);
            }}
          />
        </Layout.Content>
      </Layout>

      <Modal
        className="match-details-modal"
        title="Match Details"
        open={!!matchDetailsKey}
        onCancel={() => setMatchDetailsKey(null)}
        footer={<Button onClick={() => setMatchDetailsKey(null)}>Close</Button>}
        width={720}
      >
        {selectedMatchDetails ? (
          <>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Order">{selectedMatchDetails.orderNo}</Descriptions.Item>
              <Descriptions.Item label="Status">{selectedMatchDetails.status}</Descriptions.Item>
              <Descriptions.Item label="Matched on">{new Date(selectedMatchDetails.matchedAt).toLocaleString('en-AE')}</Descriptions.Item>
              <Descriptions.Item label="Invoices">
                {selectedMatchDetails.invoiceIds.map(id => getMatchInvoiceNumber(selectedMatchDetails, id)).join(', ')}
              </Descriptions.Item>
              <Descriptions.Item label="Receipts">{selectedMatchDetails.receiptNos.join(', ')}</Descriptions.Item>
            </Descriptions>
            {selectedMatchDetails.invoiceIds.length > 1 && (
              <p>These documents were matched as a group. Individual invoice-to-receipt allocations were not recorded.</p>
            )}
            {(() => {
              const details = selectedMatchDetails.details;
              const comparison = details ?? getCurrentMatchComparison(selectedMatchDetails, invoices);
              if (!comparison) return (
                <div className="match-outcome">
                  <p>Current document comparison is unavailable because one or more matched documents are missing.</p>
                  <div className="match-confirmed-totals">
                    <div><strong>Matched totals</strong></div>
                    <div><span>Quantity</span><strong>Unavailable</strong></div>
                    <div><span>Amount</span><strong>Unavailable</strong></div>
                  </div>
                </div>
              );
              const matchedTotals = details && getMatchedTotals(details,
                selectedMatchDetails.invoiceIds.length > 1 || selectedMatchDetails.receiptNos.length > 1 ? 'aggregate' : 'unknown');
              const formatCost = (amount: number) => comparison.currency
                ? money(amount, comparison.currency)
                : `${new Intl.NumberFormat('en-AE', { maximumFractionDigits: 2 }).format(amount)} (mixed currencies)`;
              const basisLabel = (choice: MatchResolution | undefined, differs: boolean) => {
                if (choice?.type === 'invoice') return 'Invoice';
                if (choice?.type === 'receipt') return 'Receipt';
                if (choice?.type === 'defer') return 'Deferred';
                return details && !differs ? 'No variance' : '—';
              };
              const sections = [
                { title: 'Quantity', invoice: `${comparison.invoiceQty} units`, receipt: `${comparison.receiptQty} units`,
                  variance: `${Number((comparison.invoiceQty - comparison.receiptQty).toFixed(4))} units`,
                  differs: comparison.invoiceQty !== comparison.receiptQty, choice: details?.quantityResolution },
                { title: 'Amount', invoice: formatCost(comparison.invoiceCost), receipt: formatCost(comparison.receiptCost),
                  variance: formatCost(comparison.invoiceCost - comparison.receiptCost),
                  differs: comparison.invoiceCost !== comparison.receiptCost, choice: details?.costResolution,
                  unitCost: details?.costResolutionScope === 'unit' },
              ];
              return (
                <div className="match-outcome">
                  <div className="match-outcome-heading">
                    <div>
                      <h4>Match outcome</h4>
                      {!details && <p>Current document comparison</p>}
                    </div>
                    <Tag color={selectedMatchDetails.status === 'Posted' ? 'blue' : 'green'}>{selectedMatchDetails.status}</Tag>
                  </div>
                  {comparison.currency === null && <p>Amounts in different currencies are shown without conversion.</p>}
                  <div className="match-comparison-grid">
                    {sections.map(section => (
                      <section className="match-comparison-card" key={section.title}>
                        <h5>{section.title}</h5>
                        <dl>
                          <div><dt>Invoice</dt><dd>{section.invoice}</dd></div>
                          <div><dt>Receipt</dt><dd>{section.receipt}</dd></div>
                          <div className={section.differs ? 'match-variance' : ''}><dt>Variance</dt><dd>{section.variance}</dd></div>
                        </dl>
                        <div className="match-basis">
                          <span>{section.unitCost ? 'Unit cost basis' : section.title === 'Amount' && details && !details.costResolutionScope ? 'Recorded cost choice' : 'Matching basis'}</span>
                          <strong>{basisLabel(section.choice, section.unitCost ? !!section.choice?.type : section.differs)}</strong>
                        </div>
                        {section.unitCost && <div className="match-resolution-note">Matched amount is calculated from the matched quantity and unit cost.</div>}
                        {section.choice?.reasonCode && (
                          <div className="match-resolution-note">Reason: {resolutionReasons[section.choice.reasonCode] ?? section.choice.reasonCode}</div>
                        )}
                        {section.choice?.comment && <div className="match-resolution-note">Comment: {section.choice.comment}</div>}
                      </section>
                    ))}
                  </div>
                  <div className="match-confirmed-totals">
                    <div>
                      <strong>Matched totals</strong>
                    </div>
                    <div><span>Quantity</span><strong>{matchedTotals?.quantity === undefined ? 'Unavailable' : `${matchedTotals.quantity} units`}</strong></div>
                    <div><span>Amount</span><strong>{matchedTotals?.amount === undefined ? 'Unavailable' : formatCost(matchedTotals.amount)}</strong></div>
                  </div>
                </div>
              );
            })()}
          </>
        ) : <p>Match details are no longer available.</p>}
      </Modal>

      <Modal
        className="credit-note-modal"
        title="Create Note/ Memo"
        open={creditNoteCreateOpen}
        onCancel={() => setCreditNoteCreateOpen(false)}
        onOk={handleCreateCreditNote}
        okText="Create document"
        width={720}
      >
        <div className="credit-note-fields">
          <label className="invoice-field">Document type *
            <Select
              value={creditNoteDraft.documentType}
              onChange={documentType => setCreditNoteDraft(current => ({ ...current, documentType }))}
              options={noteMemoTypes.map(type => ({ value: type, label: noteMemoTypeLabel(type) }))}
            />
          </label>
          <label className="invoice-field">Order and supplier site *
            <Select
              showSearch
              placeholder="Select an order and site"
              value={creditNoteDraft.orderInvoiceId || undefined}
              onChange={orderInvoiceId => {
                const orderInvoice = invoices.find(invoice => invoice.id === orderInvoiceId);
                setCreditNoteDraft(current => ({ ...current, orderInvoiceId, location: orderInvoice?.receipts[0]?.location || '' }));
              }}
              options={creditNoteOrderOptions}
              optionFilterProp="label"
            />
          </label>
          <label className="invoice-field">Supplier site
            <Input value={creditNoteOrder ? getSupplierSiteDisplay(creditNoteOrder) : ''} disabled />
          </label>
          <label className="invoice-field">Location
            <Input value={creditNoteDraft.location} onChange={event => setCreditNoteDraft(current => ({ ...current, location: event.target.value }))} />
          </label>
          <label className="invoice-field">Document number *
            <Input value={creditNoteDraft.documentNo} onChange={event => setCreditNoteDraft(current => ({ ...current, documentNo: event.target.value }))} />
          </label>
          <label className="invoice-field">Document date *
            <Input type="date" value={creditNoteDraft.documentDate} onChange={event => setCreditNoteDraft(current => ({ ...current, documentDate: event.target.value }))} />
          </label>
          <label className="invoice-field">Document amount * ({creditNoteOrder?.currency || 'order currency'})
            <InputNumber min={0} precision={2} value={creditNoteDraft.amount} onChange={amount => setCreditNoteDraft(current => ({ ...current, amount }))} />
          </label>
          <label className="invoice-field">Reference (optional)
            <Input value={creditNoteDraft.requestReference} onChange={event => setCreditNoteDraft(current => ({ ...current, requestReference: event.target.value }))} />
          </label>
          <label className="invoice-field credit-note-comment">Comment (optional)
            <Input.TextArea rows={2} value={creditNoteDraft.comment} onChange={event => setCreditNoteDraft(current => ({ ...current, comment: event.target.value }))} />
          </label>
        </div>
      </Modal>

      <Modal
        className="invoice-maintenance-modal"
        title={<div className="invoice-maintenance-title"><span>{detailDraftBaseline ? 'Invoice Details' : 'Invoice Maintenance'}</span><Tag color="processing">{detailDraftBaseline ? detailInvoice?.status : 'New Merchandise Invoice'}</Tag></div>}
        open={reimCreateOpen}
        onCancel={requestCloseReimCreate}
        closable={!savingInvoice}
        maskClosable={!savingInvoice}
        keyboard={!savingInvoice}
        footer={detailDraftBaseline ? [
          <Button key="close" onClick={closeReimCreate} disabled={savingInvoice}>Close</Button>,
          editingInvoice
            ? <Button key="cancel" onClick={() => {
              invoiceItemsReadId.current += 1;
              setPendingInvoiceItems(null);
              setInvoiceDraft(detailDraftBaseline);
              setEditingInvoice(false);
            }} disabled={savingInvoice}>Cancel editing</Button>
            : null,
          editingInvoice
            ? <Button key="save" type="primary" loading={savingInvoice} onClick={() => void handleSaveInvoice()}>Save</Button>
            : <Button key="edit" type="primary" disabled={!detailInvoice || detailInvoice.status !== 'Ready to Match' || !matchState || !!matchServiceError || !!getInvoiceMatch(detailInvoice.orderNo, detailInvoice.id)} onClick={() => setEditingInvoice(true)}>Edit</Button>,
        ] : [
          <Button key="cancel" onClick={requestCloseReimCreate}>Cancel</Button>,
          <Button key="create" type="primary" onClick={handleCreateReimInvoice}>Create invoice</Button>,
        ]}
        width={1120}
      >
        <ConfigProvider componentDisabled={detailReadOnly || savingInvoice}>
        <div className="invoice-maintenance-window">
          <div className="invoice-header-fields">
            <label className="invoice-field">Document type<Input value={invoiceDraft.documentType} disabled /></label>
            <label className="invoice-field">Invoice number *<Input value={invoiceDraft.invoiceNo} onChange={event => setInvoiceDraft(current => ({ ...current, invoiceNo: event.target.value }))} autoFocus /></label>
            <label className="invoice-field">Invoice status<Input value={detailInvoice?.status ?? 'Ready to Match'} disabled /></label>
            <label className="invoice-field">Group ID<Input value={invoiceDraft.groupId} onChange={event => setInvoiceDraft(current => ({ ...current, groupId: event.target.value }))} /></label>
            <label className="invoice-field">Invoice date<Input type="date" value={invoiceDraft.invoiceDate} onChange={event => setInvoiceDraft(current => ({ ...current, invoiceDate: event.target.value }))} /></label>
            <label className="invoice-field">Match date<Input type="date" value={invoiceDraft.matchDate} onChange={event => setInvoiceDraft(current => ({ ...current, matchDate: event.target.value }))} /></label>
            <label className="invoice-field">Invoice terms<Input value={invoiceDraft.invoiceTerms} onChange={event => setInvoiceDraft(current => ({ ...current, invoiceTerms: event.target.value }))} /></label>
            <label className="invoice-field">Order terms<Input value={invoiceDraft.orderTerms} onChange={event => setInvoiceDraft(current => ({ ...current, orderTerms: event.target.value }))} /></label>
            <label className="invoice-field">Supplier terms<Input value={invoiceDraft.supplierTerms} onChange={event => setInvoiceDraft(current => ({ ...current, supplierTerms: event.target.value }))} /></label>
            <label className="invoice-field">Vendor type<Select value={invoiceDraft.vendorType || undefined} onChange={vendorType => setInvoiceDraft(current => ({ ...current, vendorType }))} options={[{ value: 'Supplier', label: 'Supplier' }]} /></label>
            <label className="invoice-field">Supplier site number *<Input value={invoiceDraft.supplierSite} onChange={event => setInvoiceDraft(current => ({ ...current, supplierSite: event.target.value }))} /></label>
            <label className="invoice-field">Supplier site name *<Input value={invoiceDraft.supplierSiteName} onChange={event => setInvoiceDraft(current => ({ ...current, supplierSiteName: event.target.value }))} /></label>
            <label className="invoice-field">Order type<Select value={invoiceDraft.type} onChange={type => setInvoiceDraft(current => ({ ...current, type }))} options={['CFS', 'CDC', 'RDC', 'Local', 'DSD', 'Direct'].map(type => ({ value: type, label: type }))} /></label>
            <label className="invoice-field">Order number *<Input value={invoiceDraft.orderNo} disabled={!!detailDraftBaseline || detailReadOnly || savingInvoice} onChange={event => setInvoiceDraft(current => ({ ...current, orderNo: event.target.value }))} /></label>
            <label className="invoice-field">Location<Input value={invoiceDraft.location} onChange={event => setInvoiceDraft(current => ({ ...current, location: event.target.value }))} /></label>
            <label className="invoice-field">Invoice currency<Select value={invoiceDraft.currency} onChange={currency => setInvoiceDraft(current => ({ ...current, currency }))} options={['AED', 'SAR', 'OMR', 'BHD', 'KWD', 'QAR'].map(currency => ({ value: currency, label: currency }))} /></label>
            <label className="invoice-field">Exchange rate<InputNumber min={0} value={invoiceDraft.exchangeRate} onChange={value => setInvoiceDraft(current => ({ ...current, exchangeRate: value }))} /></label>
            <label className="invoice-field">Due date<Input type="date" value={invoiceDraft.dueDate} onChange={event => setInvoiceDraft(current => ({ ...current, dueDate: event.target.value }))} /></label>
            <label className="invoice-field">Freight payment type<Select allowClear value={invoiceDraft.freightPaymentType || undefined} onChange={value => setInvoiceDraft(current => ({ ...current, freightPaymentType: value ?? '' }))} options={['Collect', 'Prepaid', 'Third Party'].map(value => ({ value, label: value }))} /></label>
            <label className="invoice-field">Payment hold status<Input value={invoiceDraft.paymentHoldStatus} disabled /></label>
          </div>

          <div className="invoice-check-options">
            {([
              ['ediInvoice', 'EDI Invoice'],
              ['prePaid', 'Pre-Paid'],
              ['manuallyPaid', 'Manually-Paid'],
              ['detailsAttached', 'Details Attached'],
              ['consignment', 'Consignment'],
              ['directStoreDelivery', 'Direct Store Delivery'],
              ['evaluatedReceiptSettlement', 'Evaluated Receipt Settlement'],
            ] as const).map(([field, label]) => (
              <Checkbox key={field} checked={invoiceDraft[field] === true} indeterminate={invoiceDraft[field] === null} onChange={event => setInvoiceDraft(current => ({ ...current, [field]: event.target.checked }))}>{label}</Checkbox>
            ))}
          </div>

          <section className="invoice-items">
            <div className="invoice-totals-header">
              <strong>Invoice items *</strong>
              <div className="invoice-item-actions">
                <Button disabled={false} icon={<DownloadOutlined />} onClick={downloadInvoiceItems}>Download CSV</Button>
                <Button icon={<UploadOutlined />} onClick={() => invoiceItemsFileRef.current?.click()}>Upload CSV</Button>
                <Button icon={<PlusOutlined />} onClick={() => setInvoiceDraft(current => ({
                  ...current, items: [...current.items, createInvoiceDraftItem()],
                }))}>Add item</Button>
              </div>
            </div>
            <input ref={invoiceItemsFileRef} type="file" accept=".csv,text/csv" hidden onChange={uploadInvoiceItems} />
            <p>Download and edit items in a UTF-8 CSV file. Uploading replaces the current list. Keep item numbers as text to preserve leading zeros.</p>
            {invoiceDraft.items.length === 0 && <p>{detailReadOnly ? 'No invoice items recorded.' : 'Add at least one invoice item.'}</p>}
            {invoiceDraft.items.map((item, index) => {
              const amount = getInvoiceItemAmount(item);
              return (
                <div className="invoice-item" key={item.id}>
                  <div className="invoice-item-heading">
                    <strong>Item {index + 1}</strong>
                    <Button type="link" danger onClick={() => setInvoiceDraft(current => ({
                      ...current, items: current.items.filter(row => row.id !== item.id),
                    }))} aria-label={`Remove item ${index + 1}`}>Remove</Button>
                  </div>
                  <div className="invoice-item-fields">
                    <label className="invoice-field">Item number *
                      <Input aria-label={`Item ${index + 1} number`} value={item.item}
                        onChange={event => updateInvoiceDraftItem(item.id, { item: event.target.value })} />
                    </label>
                    <label className="invoice-field">Description
                      <Input aria-label={`Item ${index + 1} description`} value={item.description}
                        onChange={event => updateInvoiceDraftItem(item.id, { description: event.target.value })} />
                    </label>
                    <label className="invoice-field">Quantity *
                      <InputNumber aria-label={`Item ${index + 1} quantity`} min={1} precision={0} value={item.quantity}
                        onChange={quantity => updateInvoiceDraftItem(item.id, { quantity })} />
                    </label>
                    <label className="invoice-field">Unit cost ex tax *
                      <InputNumber aria-label={`Item ${index + 1} unit cost`} min={0} precision={4} value={item.unitCost}
                        onChange={unitCost => updateInvoiceDraftItem(item.id, { unitCost })} />
                    </label>
                    <div className="invoice-total-value"><span>Line total ex tax</span><strong>{amount === undefined ? '—' : money(amount, invoiceDraft.currency)}</strong></div>
                  </div>
                </div>
              );
            })}
          </section>

          <div className="invoice-totals-header">
            <strong>Invoice totals</strong>
            <Button disabled={false} icon={<FileSearchOutlined />} onClick={() => {
              taxEditorOriginal.current = { taxCode: invoiceDraft.taxCode, taxRate: invoiceDraft.taxRate };
              setTaxEditorOpen(true);
            }}>Tax breakdown</Button>
          </div>
          {detailInvoice && financialChanged && <p>Changes to items, tax or charges recalculate the invoice total. Complete the tax and charges before saving.</p>}
          <div className="invoice-totals-grid">
            <div className="invoice-total-value"><span>Total merchandise cost ex tax</span><strong>{!invoiceDraft.items.length && detailInvoice?.legacyDetails && !financialChanged ? money(detailInvoice.legacyDetails.costExTax, invoiceDraft.currency) : invoiceDraft.items.length ? money(draftItemTotals.merchandiseCost, invoiceDraft.currency) : '—'}</strong></div>
            <label className="invoice-field">Total non-merch cost ex tax<InputNumber min={0} precision={2} value={invoiceDraft.nonMerchCostExTax} onChange={value => setInvoiceDraft(current => ({ ...current, nonMerchCostExTax: value }))} /></label>
            <div className="invoice-total-value"><span>Total cost ex tax</span><strong>{!invoiceDraft.items.length && detailInvoice?.legacyDetails && !financialChanged ? money(detailInvoice.legacyDetails.costExTax + detailInvoice.legacyDetails.nonMerchCostExTax, invoiceDraft.currency) : totalExTax === null || !invoiceDraft.items.length ? '—' : money(totalExTax, invoiceDraft.currency)}</strong></div>
            <div className="invoice-total-value"><span>Total tax cost{invoiceDraft.taxCode ? ` · ${invoiceDraft.taxCode}` : ''}{invoiceDraft.taxRate !== null ? ` ${invoiceDraft.taxRate}%` : ''}</span><strong>{detailInvoice?.legacyDetails && !financialChanged ? money(detailInvoice.legacyDetails.taxCost, invoiceDraft.currency) : draftTaxCost === null || !invoiceDraft.items.length ? '—' : money(draftTaxCost, invoiceDraft.currency)}</strong></div>
            <div className="invoice-total-value"><span>Invoice quantity</span><strong>{!invoiceDraft.items.length && detailInvoice?.legacyDetails && !financialChanged ? detailInvoice.legacyDetails.invoiceQty : invoiceDraft.items.length ? draftItemTotals.quantity : '—'}</strong></div>
            <label className="invoice-field">Total allowances<InputNumber min={0} precision={2} value={invoiceDraft.allowances} onChange={value => setInvoiceDraft(current => ({ ...current, allowances: value }))} /></label>
            <div className="invoice-total-value invoice-grand-total"><span>Total cost inc tax</span><strong>{detailInvoice && !financialChanged ? money(detailInvoice.amount, invoiceDraft.currency) : totalInvoiceCost === null ? '—' : money(totalInvoiceCost, invoiceDraft.currency)}</strong></div>
          </div>
          <div className="invoice-reference-fields">
            <label className="invoice-field">Ref No. 1<Input value={invoiceDraft.refNo1} onChange={event => setInvoiceDraft(current => ({ ...current, refNo1: event.target.value }))} /></label>
            <label className="invoice-field">Ref No. 2<Input value={invoiceDraft.refNo2} onChange={event => setInvoiceDraft(current => ({ ...current, refNo2: event.target.value }))} /></label>
            <label className="invoice-field">Ref No. 3<Input value={invoiceDraft.refNo3} onChange={event => setInvoiceDraft(current => ({ ...current, refNo3: event.target.value }))} /></label>
            <label className="invoice-field">Ref No. 4<Input value={invoiceDraft.refNo4} onChange={event => setInvoiceDraft(current => ({ ...current, refNo4: event.target.value }))} /></label>
          </div>
        </div>
        </ConfigProvider>
      </Modal>

      <Modal
        title="Discard invoice draft?"
        open={discardInvoiceDraftOpen}
        onCancel={() => setDiscardInvoiceDraftOpen(false)}
        onOk={closeReimCreate}
        okText="Discard draft"
        cancelText="Keep editing"
        okButtonProps={{ danger: true }}
      >
        <p>Your unsaved invoice details will be lost.</p>
      </Modal>

      <Modal
        title="Replace invoice items?"
        open={pendingInvoiceItems !== null}
        onCancel={() => setPendingInvoiceItems(null)}
        onOk={() => {
          if (pendingInvoiceItems === null) return;
          setInvoiceDraft(current => ({ ...current, items: pendingInvoiceItems }));
          messageApi.success(`${pendingInvoiceItems.length} invoice item${pendingInvoiceItems.length === 1 ? '' : 's'} uploaded.`);
          setPendingInvoiceItems(null);
        }}
        okText="Replace items"
      >
        <p>Replace the current item list with {pendingInvoiceItems?.length ?? 0} item(s) from the CSV? Items removed from the file will be removed from the invoice.</p>
      </Modal>

      <Modal
        className="tax-code-modal"
        title="Tax Breakdown"
        open={taxEditorOpen}
        onCancel={() => {
          if (taxEditorOriginal.current) setInvoiceDraft(current => ({ ...current, ...taxEditorOriginal.current }));
          setTaxEditorOpen(false);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            if (taxEditorOriginal.current) setInvoiceDraft(current => ({ ...current, ...taxEditorOriginal.current }));
            setTaxEditorOpen(false);
          }}>{detailReadOnly ? 'Close' : 'Cancel'}</Button>,
          ...(!detailReadOnly ? [<Button key="apply" type="primary" onClick={() => setTaxEditorOpen(false)}>Apply tax code</Button>] : []),
        ]}
        width={700}
      >
        <div className="tax-breakdown-summary">
          <div><span>Ex tax basis</span><strong>{totalExTax === null || !invoiceDraft.items.length ? '—' : money(totalExTax, invoiceDraft.currency)}</strong></div>
          <div><span>Selected tax code</span><strong>{invoiceDraft.taxCode ? `${invoiceDraft.taxCode} · ${invoiceDraft.taxRate}%` : '—'}</strong></div>
          <div><span>Tax total</span><strong>{draftTaxCost === null || !invoiceDraft.items.length ? '—' : money(draftTaxCost, invoiceDraft.currency)}</strong></div>
        </div>
        <Table
          className="legacy-tax-table"
          size="small"
          rowKey="code"
          pagination={false}
          dataSource={legacyTaxCodes}
          rowSelection={detailReadOnly ? undefined : {
            type: 'radio',
            selectedRowKeys: [invoiceDraft.taxCode],
            onChange: keys => {
              const selectedCode = String(keys[0] ?? '');
              const selectedTax = legacyTaxCodes.find(tax => tax.code === selectedCode);
              if (selectedTax) setInvoiceDraft(current => ({ ...current, taxCode: selectedTax.code, taxRate: selectedTax.rate }));
            },
          }}
          onRow={detailReadOnly ? undefined : tax => ({
            onClick: () => setInvoiceDraft(current => ({ ...current, taxCode: tax.code, taxRate: tax.rate })),
          })}
          columns={[
            { title: 'Tax code', dataIndex: 'code', key: 'code' },
            { title: 'Tax rate', dataIndex: 'rate', key: 'rate', align: 'right', render: (rate: number) => `${rate}%` },
            { title: 'Tax amount', key: 'amount', align: 'right', render: (_, tax: { rate: number }) => totalExTax === null || !invoiceDraft.items.length ? '—' : money(Number((totalExTax * tax.rate / 100).toFixed(2)), invoiceDraft.currency) },
          ]}
        />
      </Modal>

      <Modal
        className="legacy-reference-modal"
        title="Legacy invoice and tax breakdown"
        open={taxBreakdownOpen}
        onCancel={() => setTaxBreakdownOpen(false)}
        footer={<Button onClick={() => setTaxBreakdownOpen(false)}>Close</Button>}
        width={760}
      >
        {selectedInvoice.legacyDetails && (
          <div className="legacy-reference-content">
            <div className="legacy-reference-banner">
              <span>Oracle legacy screen reference</span>
              <Tag color={statusColor[selectedInvoice.status]}>{selectedInvoice.status}</Tag>
            </div>
            <Descriptions bordered size="small" column={2} className="legacy-description">
              <Descriptions.Item label="Document type">{selectedInvoice.legacyDetails.documentType}</Descriptions.Item>
              <Descriptions.Item label="Invoice number">{selectedInvoice.invoiceNo}</Descriptions.Item>
              <Descriptions.Item label="Group ID">{selectedInvoice.legacyDetails.groupId}</Descriptions.Item>
              <Descriptions.Item label="Supplier site">{getSupplierSiteDisplay(selectedInvoice)}</Descriptions.Item>
              <Descriptions.Item label="Order number">{selectedInvoice.orderNo}</Descriptions.Item>
              <Descriptions.Item label="Location">{selectedInvoice.legacyDetails.location}</Descriptions.Item>
              <Descriptions.Item label="Invoice date">{selectedInvoice.invoiceDate}</Descriptions.Item>
              <Descriptions.Item label="Due date">{selectedInvoice.legacyDetails.dueDate}</Descriptions.Item>
              <Descriptions.Item label="Invoice terms">{selectedInvoice.legacyDetails.invoiceTerms}</Descriptions.Item>
              <Descriptions.Item label="Order terms">{selectedInvoice.legacyDetails.orderTerms}</Descriptions.Item>
              <Descriptions.Item label="Supplier terms">{selectedInvoice.legacyDetails.supplierTerms}</Descriptions.Item>
              <Descriptions.Item label="Exchange rate">{selectedInvoice.legacyDetails.exchangeRate}</Descriptions.Item>
              <Descriptions.Item label="Payment hold">{selectedInvoice.legacyDetails.paymentHoldStatus}</Descriptions.Item>
              <Descriptions.Item label="Details attached">{selectedInvoice.legacyDetails.detailsAttached ? 'Yes' : 'No'}</Descriptions.Item>
              <Descriptions.Item label="Reference">{selectedInvoice.legacyDetails.reference}</Descriptions.Item>
            </Descriptions>
            <div className="legacy-financial-grid">
              <div><span>Merchandise cost ex tax</span><strong>{money(selectedInvoice.legacyDetails.costExTax)}</strong></div>
              <div><span>Non-merchandise cost ex tax</span><strong>{money(selectedInvoice.legacyDetails.nonMerchCostExTax)}</strong></div>
              <div><span>Total cost ex tax</span><strong>{money(selectedInvoice.legacyDetails.costExTax + selectedInvoice.legacyDetails.nonMerchCostExTax)}</strong></div>
              <div><span>Total tax cost</span><strong>{money(selectedInvoice.legacyDetails.taxCost)}</strong></div>
              <div><span>Invoice quantity</span><strong>{selectedInvoice.legacyDetails.invoiceQty}</strong></div>
              <div><span>Total allowances</span><strong>{money(selectedInvoice.legacyDetails.allowances)}</strong></div>
              <div className="legacy-total"><span>Total cost inc tax</span><strong>{money(selectedInvoice.legacyDetails.costIncTax)}</strong></div>
            </div>
            <div className="legacy-tax-heading">
              <div><strong>Tax code selection</strong><span>Reference values captured from the legacy tax breakdown screen.</span></div>
              <Tag color="blue">Selected: {selectedInvoice.legacyDetails.taxCode} · {selectedInvoice.legacyDetails.taxRate}%</Tag>
            </div>
            <Table
              className="legacy-tax-table"
              size="small"
              rowKey="code"
              pagination={false}
              dataSource={legacyTaxCodes}
              rowClassName={record => record.code === selectedInvoice.legacyDetails?.taxCode ? 'legacy-tax-selected' : ''}
              columns={[
                { title: 'Tax code', dataIndex: 'code', key: 'code' },
                { title: 'Tax rate', dataIndex: 'rate', key: 'rate', align: 'right', render: (rate: number) => `${rate}%` },
              ]}
            />
          </div>
        )}
      </Modal>


      <Modal
        className="resolve-discrepancy-modal"
        title="Resolve Discrepancy"
        open={resolveDiscrepancyOpen}
        onCancel={() => setResolveDiscrepancyOpen(false)}
        width={900}
        centered
        footer={[
          <Button key="cancel" onClick={() => setResolveDiscrepancyOpen(false)}>Cancel</Button>,
          <Button key="apply" type="primary" onClick={handleApplyDiscrepancyResolution} disabled={!resolutionTarget || (!resolutionIsAggregate && (!resolutionLine || resolutionReceiptCost === undefined))}>Apply</Button>,
        ]}
      >
        {(() => {
          if (!resolutionTarget || !resolutionInvoice || !resolutionReceipt) return null;
          const currentInvoice = resolutionInvoice;
          const receipt = resolutionReceipt;
          const selectedInvoiceIds = selectedInvoicesByOrder[resolutionTarget.orderNo] || [];
          const selectedReceiptNos = selectedReceiptsByOrder[resolutionTarget.orderNo] || [];
          const selectedInvoices = invoices.filter(invoice => selectedInvoiceIds.includes(invoice.id));
          const suppliers = Array.from(new Set(selectedInvoices.map(getSupplierSiteDisplay)));
          const invoiceQty = resolutionIsAggregate ? getCumulativeInvoiceQtyByOrder(resolutionTarget.orderNo) : resolutionLine?.invoiceQty ?? 0;
          const receiptQty = resolutionIsAggregate ? getCumulativeReceiptQtyByOrder(resolutionTarget.orderNo) : receipt.quantity;
          const invoiceCost = resolutionIsAggregate ? getCumulativeInvoiceCostByOrder(resolutionTarget.orderNo) : resolutionLine?.unitCost ?? 0;
          const receiptCost = resolutionIsAggregate ? getCumulativeReceiptCostByOrder(resolutionTarget.orderNo) : resolutionReceiptCost;

          return (
            <div>
              <div className="resolution-summary">
                <div className="resolution-summary-grid">
                  <div>
                    <div style={{fontSize: 12, color: '#999'}}>Order No.</div>
                    <div style={{fontWeight: 600}}>{currentInvoice.orderNo}</div>
                  </div>
                  <div>
                    <div style={{fontSize: 12, color: '#999'}}>Supplier Site</div>
                    <div style={{fontWeight: 600}}>{suppliers.join(', ')}</div>
                  </div>
                  <div>
                    <div style={{fontSize: 12, color: '#999'}}>Invoice</div>
                    <div style={{fontWeight: 600}}>{selectedInvoices.map(invoice => invoice.invoiceNo).join(', ')}</div>
                  </div>
                  <div>
                    <div style={{fontSize: 12, color: '#999'}}>Receipt</div>
                    <div style={{fontWeight: 600}}>{selectedReceiptNos.join(', ')}</div>
                  </div>
                </div>
              </div>

              {resolutionIsAggregate && (
                <p className="resolution-explanation">Choose the matching totals. This records the decision without changing invoice or receipt amounts.</p>
              )}
              {!resolutionIsAggregate && (!resolutionLine || receiptCost === undefined) ? (
                <p>A valid invoice item and receipt with a positive quantity are required to resolve discrepancies.</p>
              ) : !resolutionIsAggregate && !resolutionQtyMismatch && !resolutionCostMismatch ? (
                <p>Quantity and unit cost match for this item and receipt. Order totals may still differ.</p>
              ) : null}
              <div className="discrepancy-resolution-grid">
                {(resolutionIsAggregate ? invoiceQty !== receiptQty : resolutionQtyMismatch) && (
                  <section className="discrepancy-resolution-panel">
                    <h4 id="quantity-discrepancy-heading">Quantity Discrepancy</h4>
                    <Radio.Group
                      aria-labelledby="quantity-discrepancy-heading"
                      value={quantityResolution.type}
                      onChange={(e) => setQuantityResolution({...quantityResolution, type: e.target.value as 'invoice' | 'receipt' | 'defer'})}
                    >
                      <Space direction="vertical">
                        <Radio value="invoice">Invoice: {invoiceQty} units</Radio>
                        <Radio value="receipt">Receipt: {receiptQty} units</Radio>
                        <Radio value="defer">Defer Quantity Resolution</Radio>
                      </Space>
                    </Radio.Group>
                    <div className="discrepancy-resolution-fields">
                      <div>
                        <label htmlFor="quantity-resolution-reason">Reason</label>
                        <Select 
                          id="quantity-resolution-reason"
                          placeholder="Select reason" 
                          value={quantityResolution.reasonCode || undefined}
                          onChange={(value) => setQuantityResolution({...quantityResolution, reasonCode: value})}
                          options={[
                            {label: 'Shortage', value: 'shortage'},
                            {label: 'Damaged goods', value: 'damaged'},
                            {label: 'Quantity error', value: 'qty_error'},
                          ]} 
                          style={{width: '100%'}} 
                        />
                      </div>
                      <div>
                        <label htmlFor="quantity-resolution-comment">Comment</label>
                        <Input.TextArea 
                          id="quantity-resolution-comment"
                          rows={2} 
                          placeholder="Add note (optional)"
                          value={quantityResolution.comment || ''}
                          onChange={(e) => setQuantityResolution({...quantityResolution, comment: e.target.value})}
                        />
                      </div>
                    </div>
                  </section>
                )}

                {(resolutionIsAggregate ? invoiceCost !== receiptCost : resolutionCostMismatch) && receiptCost !== undefined && (
                  <section className="discrepancy-resolution-panel">
                    <h4 id="cost-discrepancy-heading">Cost Discrepancy</h4>
                    <Radio.Group
                      aria-labelledby="cost-discrepancy-heading"
                      value={costResolution.type}
                      onChange={(e) => setCostResolution({...costResolution, type: e.target.value as 'invoice' | 'receipt' | 'defer'})}
                    >
                      <Space direction="vertical">
                        <Radio value="invoice">Invoice ({resolutionIsAggregate ? 'Total' : 'Per Unit'}): {resolutionIsAggregate ? money(invoiceCost, currentInvoice.currency) : unitMoney(invoiceCost, currentInvoice.currency)}</Radio>
                        <Radio value="receipt">Receipt ({resolutionIsAggregate ? 'Total' : 'Per Unit'}): {resolutionIsAggregate ? money(receiptCost, currentInvoice.currency) : unitMoney(receiptCost, currentInvoice.currency)}</Radio>
                        <Radio value="defer">Defer Cost Resolution</Radio>
                      </Space>
                    </Radio.Group>
                    <div className="discrepancy-resolution-fields">
                      <div>
                        <label htmlFor="cost-resolution-reason">Reason</label>
                        <Select 
                          id="cost-resolution-reason"
                          placeholder="Select reason" 
                          value={costResolution.reasonCode || undefined}
                          onChange={(value) => setCostResolution({...costResolution, reasonCode: value})}
                          options={[
                            {label: 'Pricing error', value: 'pricing'},
                            {label: 'Discount not applied', value: 'discount'},
                            {label: 'Cost error', value: 'cost_error'},
                          ]} 
                          style={{width: '100%'}} 
                        />
                      </div>
                      <div>
                        <label htmlFor="cost-resolution-comment">Comment</label>
                        <Input.TextArea 
                          id="cost-resolution-comment"
                          rows={2} 
                          placeholder="Add note (optional)"
                          value={costResolution.comment || ''}
                          onChange={(e) => setCostResolution({...costResolution, comment: e.target.value})}
                        />
                      </div>
                    </div>
                  </section>
                )}
                {!resolutionIsAggregate && !resolutionCostMismatch && receiptCost !== undefined && (
                  <p>Unit cost has no variance. Any amount difference is due to quantity.</p>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* INVOICE DETAIL MODAL */}
      <Modal
        title={(() => {
          const invoice = invoices.find(item => item.id === detailInvoiceId);
          return invoice && isNoteMemo(invoice.type) ? `${noteMemoTypeLabel(invoice.type)} Details` : 'Invoice Details';
        })()}
        open={invoiceDetailOpen}
        onCancel={() => setInvoiceDetailOpen(false)}
        width={1000}
        footer={[
          <Button key="close" type="primary" onClick={() => setInvoiceDetailOpen(false)}>Close</Button>,
        ]}
      >
        {(() => {
          const invoice = invoices.find(inv => inv.id === detailInvoiceId);
          if (!invoice) return null;
          
          return (
            <div style={{marginTop: 16}}>
              {/* HEADER SECTION */}
              <div style={{marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f0f0f0'}}>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20}}>
                  <div>
                    <div style={{fontSize: 11, color: '#999', marginBottom: 4}}>{isNoteMemo(invoice.type) ? 'Document Number' : 'Invoice Number'}</div>
                    <div style={{fontWeight: 600, fontSize: 13}}>{invoice.invoiceNo}</div>
                  </div>
                  <div>
                    <div style={{fontSize: 11, color: '#999', marginBottom: 4}}>{isNoteMemo(invoice.type) ? 'Document Date' : 'Invoice Date'}</div>
                    <div style={{fontWeight: 600, fontSize: 13}}>{invoice.invoiceDate}</div>
                  </div>
                  <div>
                    <div style={{fontSize: 11, color: '#999', marginBottom: 4}}>{isNoteMemo(invoice.type) ? 'Document Amount' : 'Invoice Amount'}</div>
                    <div style={{fontWeight: 600, fontSize: 13}}>{money(invoice.amount, invoice.currency)}</div>
                  </div>
                  <div>
                    <div style={{fontSize: 11, color: '#999', marginBottom: 4}}>Status</div>
                    <Tag color={statusColor[invoice.status]}>{invoice.status}</Tag>
                  </div>
                </div>
              </div>

              {/* SUPPLIER INFORMATION */}
              <div style={{marginBottom: 24}}>
                <h4 style={{marginTop: 0, marginBottom: 12}}>Supplier Information</h4>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, background: '#fafafa', padding: 16, borderRadius: 4}}>
                  <div>
                    <div style={{fontSize: 11, color: '#999', marginBottom: 4}}>Supplier Site Number</div>
                    <div style={{fontWeight: 500}}>{getSupplierSiteNumber(invoice) || 'Number unavailable'}</div>
                  </div>
                  <div>
                    <div style={{fontSize: 11, color: '#999', marginBottom: 4}}>Supplier Site Name</div>
                    <div style={{fontWeight: 500}}>{getSupplierSiteName(invoice)}</div>
                  </div>
                  <div>
                    <div style={{fontSize: 11, color: '#999', marginBottom: 4}}>Order Number</div>
                    <div style={{fontWeight: 500}}>{invoice.orderNo}</div>
                  </div>
                  <div>
                    <div style={{fontSize: 11, color: '#999', marginBottom: 4}}>Document Type</div>
                    <Tag>{isNoteMemo(invoice.type) ? noteMemoTypeLabel(invoice.type) : invoice.type}</Tag>
                  </div>
                </div>
              </div>

              {/* LINE ITEMS */}
              {invoice.lines.length > 0 && <div style={{marginBottom: 24}}>
                <h4 style={{marginTop: 0, marginBottom: 12}}>Line Items</h4>
                <Table
                  dataSource={invoice.lines.map((line, idx) => ({key: idx, ...line}))}
                  pagination={false}
                  size="small"
                  columns={[
                    {title: 'Item', dataIndex: 'item', width: 120},
                    {title: 'Description', dataIndex: 'description', render: (text) => <span style={{fontSize: 12}}>{text}</span>},
                    {title: 'Qty', dataIndex: 'invoiceQty', width: 80, align: 'right'},
                    {title: 'Unit Cost', dataIndex: 'unitCost', width: 100, align: 'right', render: (value) => unitMoney(value, invoice.currency)},
                    {title: 'Tax', dataIndex: 'tax', width: 60},
                  ]}
                />
              </div>}

              {invoice.noteMemoDetails && (
                <div style={{marginBottom: 24}}>
                  <h4 style={{marginTop: 0, marginBottom: 12}}>Document Details</h4>
                  <Descriptions size="small" bordered column={1}>
                    <Descriptions.Item label="Location">{invoice.noteMemoDetails.location || 'Not provided'}</Descriptions.Item>
                    <Descriptions.Item label="Reference">{invoice.noteMemoDetails.requestReference || 'Not provided'}</Descriptions.Item>
                    <Descriptions.Item label="Comment">{invoice.noteMemoDetails.comment || 'Not provided'}</Descriptions.Item>
                    <Descriptions.Item label="Source">{invoice.source}</Descriptions.Item>
                  </Descriptions>
                </div>
              )}

              {/* LEGACY DETAILS */}
              {invoice.legacyDetails && (
                <div>
                  <h4 style={{marginTop: 0, marginBottom: 12}}>Additional Details</h4>
                  <Descriptions size="small" bordered column={2}>
                    <Descriptions.Item label="Document Type">{invoice.legacyDetails.documentType}</Descriptions.Item>
                    <Descriptions.Item label="Group ID">{invoice.legacyDetails.groupId}</Descriptions.Item>
                    <Descriptions.Item label="Location">{invoice.legacyDetails.location}</Descriptions.Item>
                    <Descriptions.Item label="Due Date">{invoice.legacyDetails.dueDate}</Descriptions.Item>
                    <Descriptions.Item label="Payment Hold">{invoice.legacyDetails.paymentHoldStatus}</Descriptions.Item>
                    <Descriptions.Item label="Exchange Rate">{invoice.legacyDetails.exchangeRate}</Descriptions.Item>
                    <Descriptions.Item label="Tax Rate">{invoice.legacyDetails.taxRate}%</Descriptions.Item>
                    <Descriptions.Item label="Total Cost (ex Tax)">{money(invoice.legacyDetails.costExTax)}</Descriptions.Item>
                    <Descriptions.Item label="Tax Amount">{money(invoice.legacyDetails.taxCost)}</Descriptions.Item>
                    <Descriptions.Item label="Total Cost (inc Tax)">{money(invoice.legacyDetails.costIncTax)}</Descriptions.Item>
                    <Descriptions.Item label="Invoice Qty">{invoice.legacyDetails.invoiceQty}</Descriptions.Item>
                  </Descriptions>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* RECEIPT DETAIL MODAL */}
      <Modal
        className="receipt-details-modal"
        title="Receipt Details"
        open={receiptDetailOpen}
        onCancel={() => setReceiptDetailOpen(false)}
        width={900}
        footer={[
          <Button key="close" type="primary" onClick={() => setReceiptDetailOpen(false)}>Close</Button>,
        ]}
      >
        {(() => {
          const receipt = detailReceiptKey
            ? getReceiptsForOrder(detailReceiptKey.orderNo).find(item => item.receiptNo === detailReceiptKey.receiptNo)
            : undefined;

          if (!receipt || !detailReceiptKey) return <p>Receipt details could not be found.</p>;

          return (
            <div className="receipt-details">
              <div className="receipt-details-header">
                <div><span>Receipt number</span><strong>{receipt.receiptNo}</strong></div>
                <div><span>Receipt date</span><strong>{receipt.date}</strong></div>
                <div><span>Order number</span><strong>{detailReceiptKey.orderNo}</strong></div>
                <div><span>Location</span><strong>{receipt.location}</strong></div>
              </div>
              <section className="receipt-items">
                <div className="receipt-items-heading">
                  <h4>Receipt items</h4>
                  <span>{receipt.items.length} {receipt.items.length === 1 ? 'item' : 'items'}</span>
                </div>
                <Table
                  dataSource={receipt.items.map((item, index) => ({ ...item, key: index }))}
                  pagination={false}
                  size="middle"
                  scroll={{ x: 520 }}
                  locale={{ emptyText: 'No receipt items recorded.' }}
                  columns={[
                    { title: 'Item number', dataIndex: 'item', key: 'item', width: 115 },
                    { title: 'Description', dataIndex: 'description', key: 'description' },
                    { title: 'Received qty', dataIndex: 'quantity', key: 'quantity', align: 'right', width: 100 },
                    { title: 'Unit cost', dataIndex: 'unitCost', key: 'unitCost', align: 'right', width: 115, render: (value: number) => unitMoney(value, receipt.currency) },
                    { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right', width: 115, render: (value: number) => money(value, receipt.currency) },
                  ]}
                />
              </section>
              <div className="receipt-totals">
                <div><span>Receipt quantity</span><strong>{receipt.quantity} units</strong></div>
                <div><span>Receipt amount</span><strong>{money(receipt.amount, receipt.currency)}</strong></div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        title="Report Exception"
        className="exception-report-modal"
        open={reportOpen}
        onCancel={() => setReportOpen(false)}
        width={600}
        footer={[
          <Button key="cancel" onClick={() => setReportOpen(false)}>Cancel</Button>,
          <Button key="report" type="primary" onClick={handleExceptionReport} disabled={!reportRecipients.trim() || !reportReason}>Report Exception</Button>,
        ]}
      >
        {reportOrderNo && (() => {
          const invoiceQty = getCumulativeInvoiceQtyByOrder(reportOrderNo);
          const receiptQty = getCumulativeReceiptQtyByOrder(reportOrderNo);
          const invoiceCost = getCumulativeInvoiceCostByOrder(reportOrderNo);
          const receiptCost = getCumulativeReceiptCostByOrder(reportOrderNo);
          const qtyVariance = invoiceQty - receiptQty;
          const costVariance = invoiceCost - receiptCost;
          const selectedInvoices = invoices.filter(invoice => invoice.orderNo === reportOrderNo && (selectedInvoicesByOrder[reportOrderNo] || []).includes(invoice.id));
          const selectedReceipts = getReceiptsForOrder(reportOrderNo).filter(receipt => (selectedReceiptsByOrder[reportOrderNo] || []).includes(receipt.receiptNo));
          return (
            <div>
              <div className="exception-summary">
                <div className="exception-summary-order">
                  <span>Order number</span>
                  <strong>#{reportOrderNo}</strong>
                </div>
                <div className="exception-summary-documents">
                  <section className="exception-document">
                    <h4>Invoice details</h4>
                    {selectedInvoices.map(invoice => (
                      <div key={invoice.id} className="exception-document-entry">
                        <strong>{invoice.invoiceNo}</strong>
                        <span>{invoice.invoiceDate} · {getSupplierSiteDisplay(invoice)}</span>
                        <span>{invoice.lines.reduce((total, line) => total + line.invoiceQty, 0)} units · {money(invoice.amount, invoice.currency)}</span>
                      </div>
                    ))}
                    {selectedInvoices.length > 1 && <div className="exception-document-total">Total: {invoiceQty} units · {money(invoiceCost)}</div>}
                  </section>
                  <section className="exception-document">
                    <h4>Receipt details</h4>
                    {selectedReceipts.map(receipt => (
                      <div key={receipt.receiptNo} className="exception-document-entry">
                        <strong>{receipt.receiptNo}</strong>
                        <span>{receipt.date} · {receipt.location}</span>
                        <span>{receipt.quantity} units · {money(receipt.amount)}</span>
                      </div>
                    ))}
                    {selectedReceipts.length > 1 && <div className="exception-document-total">Total: {receiptQty} units · {money(receiptCost)}</div>}
                  </section>
                </div>
                <div className="exception-summary-variance">
                  <div><span>Quantity variance</span><strong>{qtyVariance} units ({formatVariancePercentage(qtyVariance, invoiceQty)})</strong></div>
                  <div><span>Cost variance</span><strong>{money(costVariance)} ({formatVariancePercentage(costVariance, invoiceCost)})</strong></div>
                </div>
              </div>
              <div style={{marginBottom: 16}}>
                <label htmlFor="report-recipients" style={{display: 'block', fontWeight: 600, marginBottom: 8}}>Email recipients *</label>
                <Input
                  id="report-recipients"
                  placeholder="name@example.com; name2@example.com"
                  value={reportRecipients}
                  onChange={event => setReportRecipients(event.target.value)}
                  aria-describedby="report-recipients-hint"
                />
                <div id="report-recipients-hint" style={{marginTop: 4, color: '#667082', fontSize: 12}}>Separate email addresses with a semicolon (;).</div>
              </div>
              <div style={{marginBottom: 16}}>
                <label htmlFor="report-reason" style={{display: 'block', fontWeight: 600, marginBottom: 8}}>Reason *</label>
                <Select
                  id="report-reason"
                  placeholder="Select reason"
                  value={reportReason || undefined}
                  onChange={setReportReason}
                  options={[
                    'Variance exceeds threshold',
                    'Pricing discrepancy',
                    'Quantity or delivery issue',
                    'Supplier quality issue',
                    'Other',
                  ].map(reason => ({label: reason, value: reason}))}
                  style={{width: '100%'}}
                />
              </div>
              <div>
                <label htmlFor="report-comment" style={{display: 'block', fontWeight: 600, marginBottom: 8}}>Comment (optional)</label>
                <Input.TextArea id="report-comment" rows={3} value={reportComment} onChange={event => setReportComment(event.target.value)} />
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* PHASE 2: OFIN POSTING CONFIRMATION MODAL */}
      <Modal
        className="ofin-confirmation-modal"
        title="Match Confirmed & Scheduled for Finance Posting"
        open={postingConfirmationOpen && offinPostings[postingOrderNo]?.status === 'Scheduled'}
        onCancel={() => setPostingConfirmationOpen(false)}
        width={720}
        centered
        footer={[
          <Button key="ok" type="primary" onClick={() => {
            setPostingConfirmationOpen(false);
            messageApi.success(`Order #${postingOrderNo} match confirmed and scheduled for finance posting.`);
          }}>
            OK
          </Button>,
        ]}
      >
        {(() => {
          const posting = offinPostings[postingOrderNo];
          if (!posting) return null;
          const formatAmount = (amount: number, currency: string | null) => currency
            ? money(amount, currency)
            : `${new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} (mixed currencies)`;

          return (
            <div className="posting-confirmation">
              <div className="posting-confirmation-status">
                <CheckCircleFilled className="posting-confirmation-icon" />
                <div>
                  <strong>Match confirmed</strong>
                  <span>Scheduled for finance posting</span>
                </div>
              </div>

              <section className="posting-summary" aria-label="Matched totals">
                <div>
                  <span>Matched amount</span>
                  <strong>{formatAmount(posting.matchedAmount, posting.currency)}</strong>
                </div>
                <div>
                  <span>Matched quantity</span>
                  <strong>{posting.matchedQuantity} units</strong>
                </div>
              </section>

              <section className="posting-details" aria-labelledby="posting-details-heading">
                <h4 id="posting-details-heading">Match details</h4>
                <dl>
                  <div><dt>Order</dt><dd>{postingOrderNo}</dd></div>
                  <div><dt>OFIN reference</dt><dd>{posting.referenceNumber}</dd></div>
                  <div><dt>{posting.invoiceNumbers.length === 1 ? 'Invoice' : 'Invoices'}</dt><dd>{posting.invoiceNumbers.join(', ')}</dd></div>
                  <div><dt>{posting.receiptNos.length === 1 ? 'Receipt' : 'Receipts'}</dt><dd>{posting.receiptNos.join(', ')}</dd></div>
                </dl>
              </section>

              <section className="posting-gl" aria-labelledby="posting-gl-heading">
                <h4 id="posting-gl-heading">GL line items to be posted</h4>
                <div className="posting-gl-table-wrap">
                  <table className="ofin-line-items-table">
                    <thead>
                      <tr>
                        <th scope="col">Account</th>
                        <th scope="col">Description</th>
                        <th scope="col" className="posting-gl-amount">Amount</th>
                        <th scope="col">GL date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posting.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.accountCode}</td>
                          <td>{item.description}</td>
                          <td className="posting-gl-amount">{formatAmount(item.amount, posting.receiptCurrency)}</td>
                          <td>{item.glDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          );
        })()}
      </Modal>

    </Layout>
  );
}

export default App;

