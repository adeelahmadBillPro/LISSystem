import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api'

export default function InvoiceReceipt() {
  const { invoiceId } = useParams()
  const [receipt, setReceipt] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReceipt()
  }, [invoiceId])

  const fetchReceipt = async () => {
    try {
      const r = await api.get(`/billing/invoices/${invoiceId}/receipt`)
      setReceipt(r.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return <div className="text-center py-20">Loading...</div>
  if (!receipt) return <div className="text-center py-20 text-red-500">Receipt not found</div>

  return (
    <div>
      <div className="flex gap-3 mb-4 print:hidden">
        <button onClick={() => window.print()}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">
          Print Receipt
        </button>
        <button onClick={() => window.history.back()}
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">
          Back
        </button>
      </div>

      {/* Thermal Receipt Format (80mm / 58mm width) */}
      <div className="max-w-xs mx-auto bg-white border border-slate-200 p-4 font-mono text-xs print:border-none print:max-w-full" style={{width: '300px'}}>
        {/* Header */}
        <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
          <p className="font-bold text-sm">{receipt.lab_name}</p>
          <p className="text-[10px] text-slate-500">{receipt.lab_address}</p>
          <p className="text-[10px] text-slate-500">Ph: {receipt.lab_phone}</p>
        </div>

        {/* Invoice Info */}
        <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
          <div className="flex justify-between"><span>Invoice:</span><span className="font-bold">{receipt.invoice_id}</span></div>
          <div className="flex justify-between"><span>Date:</span><span>{receipt.date}</span></div>
          <div className="flex justify-between"><span>Cashier:</span><span>{receipt.created_by || '-'}</span></div>
        </div>

        {/* Patient Info */}
        <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
          <div className="flex justify-between"><span>Patient:</span><span className="font-bold">{receipt.patient_name}</span></div>
          <div className="flex justify-between"><span>MRN:</span><span>{receipt.patient_mrn}</span></div>
          {receipt.patient_phone && <div className="flex justify-between"><span>Phone:</span><span>{receipt.patient_phone}</span></div>}
        </div>

        {/* Items */}
        <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
          <div className="flex justify-between font-bold mb-1">
            <span>Test</span><span>Price</span>
          </div>
          {receipt.items.map((item, i) => (
            <div key={i} className="flex justify-between py-0.5">
              <span className="flex-1">{item.test_name}</span>
              <span>Rs. {item.price}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
          <div className="flex justify-between"><span>Subtotal:</span><span>Rs. {receipt.subtotal}</span></div>
          {receipt.discount_percent > 0 && (
            <div className="flex justify-between text-green-600"><span>Discount ({receipt.discount_percent}%):</span><span>-Rs. {Math.round(receipt.subtotal * receipt.discount_percent / 100)}</span></div>
          )}
          <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t border-slate-200">
            <span>TOTAL:</span><span>Rs. {receipt.total}</span>
          </div>
          <div className="flex justify-between mt-1"><span>Payment:</span><span className="capitalize">{receipt.payment_method}</span></div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-400 mt-3">
          <p>Thank you for choosing us!</p>
          <p>Please keep this receipt for your records</p>
          <p className="mt-2">* * * * * * * * * * * *</p>
        </div>
      </div>
    </div>
  )
}
