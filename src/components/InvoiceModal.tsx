import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Printer,
  CheckCircle2,
  Receipt,
  AlertCircle,
  ShieldCheck,
  Copy,
  Check,
  RotateCcw
} from 'lucide-react';
import { InvoiceModel, CreditNoteModel, PaymentRecord } from '../types';
import { paymentService } from '../services/paymentService';
import { downloadInvoicePdf, downloadCreditNotePdf } from '../utils/pdfGenerator';
import { formatStudentId, formatInvoiceNumber, formatCreditNoteNumber } from '../utils/studentId';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentRecord?: PaymentRecord | null;
  paymentId?: string | null;
  preloadedInvoice?: InvoiceModel | null;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  paymentRecord,
  paymentId,
  preloadedInvoice
}) => {
  const [invoice, setInvoice] = useState<InvoiceModel | null>(preloadedInvoice || null);
  const [creditNote, setCreditNote] = useState<CreditNoteModel | null>(null);
  const [isCreditNote, setIsCreditNote] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const effectivePaymentId = paymentId || paymentRecord?.razorpayPaymentId || paymentRecord?.id;

  useEffect(() => {
    if (!isOpen) {
      setInvoice(null);
      setCreditNote(null);
      setIsCreditNote(false);
      setError(null);
      return;
    }

    if (preloadedInvoice) {
      setInvoice(preloadedInvoice);
      setIsCreditNote(false);
      return;
    }

    // If transaction is already known to be refunded, prepare credit note state
    const isRefunded = paymentRecord?.status === 'refunded';

    if (effectivePaymentId) {
      setIsLoading(true);
      setError(null);
      paymentService.fetchInvoiceDetails(effectivePaymentId).then((res) => {
        setIsLoading(false);
        if (res.error) {
          setError(
            typeof res.error === 'string'
              ? res.error
              : (res.error.message || 'Authoritative tax document could not be retrieved.')
          );
        } else if (res.isCreditNote && res.creditNote) {
          setCreditNote(res.creditNote);
          setIsCreditNote(true);
        } else if (res.data) {
          setInvoice(res.data);
          setIsCreditNote(false);
        } else {
          setError('Authoritative tax invoice record not found or not yet captured.');
        }
      });
    }
  }, [isOpen, effectivePaymentId, preloadedInvoice, paymentRecord]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!invoice && !creditNote && !paymentRecord) return;
    setIsDownloading(true);

    try {
      const payId = effectivePaymentId || 'pay_ref';

      if (isCreditNote && creditNote) {
        const res = await paymentService.downloadOfficialCreditNote(payId, creditNote.creditNoteNumber);
        if (!res.success) {
          downloadCreditNotePdf({
            creditNoteNumber: creditNote.creditNoteNumber,
            originalInvoiceNumber: creditNote.originalInvoiceNumber,
            creditNoteDate: creditNote.creditNoteDate,
            reason: creditNote.reason,
            refundId: creditNote.refundId,
            paymentId: creditNote.paymentId,
            customerName: creditNote.customer.name,
            customerEmail: creditNote.customer.email,
            studentId: creditNote.customer.studentId,
            refundAmount: creditNote.refundAmount,
            currency: creditNote.currency
          });
        }
      } else if (invoice) {
        const invNum = invoice.invoiceNumber;
        const res = await paymentService.downloadOfficialInvoice(payId, invNum);
        if (!res.success) {
          downloadInvoicePdf({
            paymentId: invoice.payment.paymentId,
            orderId: invoice.payment.orderId,
            customerName: invoice.customer.name,
            customerEmail: invoice.customer.email,
            customerState: invoice.customer.state,
            studentId: invoice.customer.studentId,
            enrollmentId: invoice.item.enrollmentId,
            itemTitle: invoice.item.title,
            itemType: invoice.item.rawType,
            amount: invoice.payment.totalAmount,
            currency: invoice.payment.currency,
            paymentDate: invoice.paymentDate,
            status: invoice.payment.status,
            invoiceNumber: invNum
          });
        }
      }
    } catch {
      // Direct client fallback
      if (invoice) {
        downloadInvoicePdf({
          paymentId: invoice.payment.paymentId,
          orderId: invoice.payment.orderId,
          customerName: invoice.customer.name,
          customerEmail: invoice.customer.email,
          customerState: invoice.customer.state,
          studentId: invoice.customer.studentId,
          enrollmentId: invoice.item.enrollmentId,
          itemTitle: invoice.item.title,
          itemType: invoice.item.rawType,
          amount: invoice.payment.totalAmount,
          currency: invoice.payment.currency,
          paymentDate: invoice.paymentDate,
          status: invoice.payment.status,
          invoiceNumber: invoice.invoiceNumber
        });
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 print:p-0 print:bg-white">
      <div
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto print:border-none print:shadow-none print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60 print:hidden">
          <div className="flex items-center gap-2">
            {isCreditNote ? (
              <>
                <RotateCcw className="w-4 h-4 text-rose-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-800 font-mono">
                  Statutory Credit Note (Sec 34 CGST Act)
                </span>
              </>
            ) : (
              <>
                <Receipt className="w-4 h-4 text-[#FF6B00]" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
                  GST Tax Invoice & Payment Receipt
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || (!invoice && !creditNote)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isLoading || isDownloading || (!invoice && !creditNote && !paymentRecord)}
              className={`px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 ${
                isCreditNote ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#2457D6] hover:bg-[#1d46ad]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isDownloading
                  ? 'Downloading...'
                  : isCreditNote
                  ? 'Download Credit Note PDF'
                  : 'Download Invoice PDF'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Document Body */}
        <div className="p-6 sm:p-8 md:p-10 space-y-8 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Retrieving Authoritative Tax Document...
              </p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <h4 className="text-sm font-bold">Document Notice</h4>
              <p className="text-xs text-amber-800">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          ) : isCreditNote && creditNote ? (
            /* ========================================================================= */
            /* CREDIT NOTE VIEW (SECTION 34 CGST ACT)                                    */
            /* ========================================================================= */
            <>
              {/* Header: Seller & Credit Note Badge */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-rose-200">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
                      {creditNote.seller.businessName}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Brand: {creditNote.seller.brand}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-0.5 font-sans">
                    <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-slate-800">
                      <span>GSTIN: {creditNote.seller.gstin}</span>
                      <span>·</span>
                      <span>State: {creditNote.seller.stateName} ({creditNote.seller.stateCode})</span>
                    </div>
                    <div>Business Address: {creditNote.seller.businessAddress}</div>
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold uppercase tracking-wider font-mono">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Credit Note / Refunded</span>
                  </span>
                  <div className="text-lg font-bold font-mono text-rose-800">
                    {creditNote.creditNoteNumber}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Original Tax Invoice: {creditNote.originalInvoiceNumber}
                  </div>
                </div>
              </div>

              {/* Two-Column Information Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-rose-50/40 border border-rose-200 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700">
                    Issued To (Student / Recipient)
                  </span>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-900">
                      {creditNote.customer.name}
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-800">
                      Student ID: {creditNote.customer.studentId}
                    </div>
                    <div className="text-xs text-slate-600">{creditNote.customer.email}</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Refund & Reversal Reference
                  </span>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Original Payment:</span>
                      <span className="font-mono text-slate-800 text-[11px]">{creditNote.paymentId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Reason:</span>
                      <span className="font-semibold text-slate-800">{creditNote.reason}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Statutory Section:</span>
                      <span className="font-mono text-slate-800 text-[11px]">Section 34 CGST Act, 2017</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Adjustment Summary */}
              <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-700">
                  <span>Base Educational Value Reversed:</span>
                  <span>-₹{creditNote.baseRefundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>GST Output Tax Liability Adjusted (18%):</span>
                  <span>-₹{creditNote.taxAdjustmentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-2 border-t border-rose-200 flex items-center justify-between text-sm font-bold text-rose-900">
                  <span>Total Net Refund Processed:</span>
                  <span>₹{creditNote.refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {creditNote.currency}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 text-center">
                This Credit Note serves as legal documentation of payment reversal and tax adjustment under Indian GST laws.
              </div>
            </>
          ) : invoice ? (
            /* ========================================================================= */
            /* STANDARD GST TAX INVOICE VIEW                                             */
            /* ========================================================================= */
            <>
              {/* Header: Seller & Invoice Badge */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
                      {invoice.seller.businessName}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-50 text-[#FF6B00] border border-orange-200">
                      Brand: {invoice.seller.brand}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-0.5 font-sans">
                    <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-slate-800">
                      <span>GSTIN: {invoice.seller.gstin}</span>
                      <span>·</span>
                      <span>State Code: {invoice.seller.stateCode} ({invoice.seller.stateName})</span>
                    </div>
                    <div>Business Address: {invoice.seller.businessAddress}</div>
                    <div className="text-slate-500 text-[11px]">
                      Service Coverage: {invoice.seller.coverage} · {invoice.seller.websiteUrl}
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold uppercase tracking-wider font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tax Invoice / Paid</span>
                  </span>
                  <div className="text-lg font-bold font-mono text-slate-900">
                    {invoice.invoiceNumber}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Date:{' '}
                    {(() => {
                      try {
                        return new Date(invoice.paymentDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        });
                      } catch {
                        return 'Recent';
                      }
                    })()}
                  </div>
                </div>
              </div>

              {/* Two-Column Information Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Billed To (Student) */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Billed To (Student / Recipient)
                  </span>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-900">
                      {invoice.customer.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#2457D6] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        Student ID: {invoice.customer.studentId}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(invoice.customer.studentId, 'studentId')}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Copy Student ID"
                      >
                        {copiedKey === 'studentId' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="text-xs text-slate-600 truncate">
                      {invoice.customer.email}
                    </div>
                    <div className="text-xs text-slate-600 font-medium">
                      Place of Supply / State: {invoice.customer.state || 'Unspecified / Inter-state'}
                    </div>
                    {invoice.customer.phone && invoice.customer.phone !== 'N/A' && (
                      <div className="text-xs text-slate-500 font-mono">
                        Phone: {invoice.customer.phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Gateway & Settlement */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Payment Gateway Settlement
                  </span>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Gateway:</span>
                      <span className="font-semibold text-slate-800">{invoice.payment.gateway} Electronic</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment ID:</span>
                      <span className="font-mono text-slate-800 text-[11px] truncate max-w-[170px]" title={invoice.payment.paymentId}>
                        {invoice.payment.paymentId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Order ID:</span>
                      <span className="font-mono text-slate-600 text-[11px] truncate max-w-[170px]" title={invoice.payment.orderId}>
                        {invoice.payment.orderId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment Status:</span>
                      <span className="font-semibold text-emerald-600 uppercase text-[10px]">Captured & Settled</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-900 text-white uppercase font-mono text-[10px] tracking-wider">
                      <th className="py-3 px-4 font-semibold">Description</th>
                      <th className="py-3 px-4 font-semibold">SAC Code</th>
                      <th className="py-3 px-4 font-semibold">Category</th>
                      <th className="py-3 px-4 font-semibold text-center">Qty</th>
                      <th className="py-3 px-4 font-semibold text-right">Taxable Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-3.5 px-4 font-medium max-w-xs">
                        <div className="font-bold text-slate-900 text-sm">{invoice.item.title}</div>
                        <div className="text-[11px] text-slate-500">{invoice.item.sacDescription}</div>
                        {invoice.item.enrollmentId && (
                          <div className="text-[11px] font-mono text-[#FF6B00] font-semibold mt-0.5">
                            Enrolment ID: {invoice.item.enrollmentId}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {invoice.item.sacCode}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {invoice.item.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-center">
                        {invoice.item.quantity}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-right text-slate-900">
                        ₹{invoice.item.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tax Breakdown & Total Summary */}
              <div className="flex flex-col sm:flex-row justify-between gap-6 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 max-w-sm space-y-1.5 self-start">
                  <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Verified GST Rule 46(b) Tax Invoice</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                    Issued under GSTIN 09CHHPK9834Q1ZB by MK Digitalverse (DigitalMuid). Serial number is consecutive and compliant with Rule 46(b) of the CGST Rules, 2017.
                  </p>
                </div>

                <div className="w-full sm:w-72 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Taxable Base Value:</span>
                    <span>₹{invoice.payment.baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  {invoice.payment.isExport ? (
                    <div className="flex items-center justify-between text-emerald-700 font-semibold">
                      <span>Export under LUT (0%):</span>
                      <span>Zero-Rated</span>
                    </div>
                  ) : invoice.payment.igstAmount > 0 ? (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>IGST (18%):</span>
                      <span>₹{invoice.payment.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>CGST (9%):</span>
                        <span>₹{invoice.payment.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>SGST (9%):</span>
                        <span>₹{invoice.payment.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-slate-900">
                    <span>Total Paid (Net):</span>
                    <span className="text-[#FF6B00]">
                      ₹{invoice.payment.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {invoice.payment.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statutory Note */}
              <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 text-center space-y-1">
                <div>DigitalMuid · MK Digitalverse · Lucknow, India · Serving Globally</div>
                <div>Note: SAC code classifications and tax calculations are subject to periodic review by our registered Chartered Accountant.</div>
                <div>For billing inquiries or corporate expensing: support@digitalmuid.in</div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
