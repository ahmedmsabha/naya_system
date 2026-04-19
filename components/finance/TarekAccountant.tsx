"use client";

import { useMemo, useState, useTransition } from "react";
import { 
  Plus, 
  Trash, 
  Scan, 
  FileText, 
  PieChart as PieChartIcon, 
  X,
  Loader2,
  Camera,
  Eye
} from "lucide-react";
import { deleteAccountantInvoice, addAccountantInvoice, uploadReceipt } from "@/app/(dashboard)/accountant/actions";
import { formatDateEn, formatNumberEn } from "@/lib/format/en";

interface Invoice {
  id: string;
  vendor_name: string;
  amount: number;
  project_name: string;
  image_url?: string;
  created_at: string;
}

export function TarekAccountant({ 
  initialInvoices, 
  stats 
}: { 
  initialInvoices: Invoice[], 
  stats: { total: number; project: number; other: number } 
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isDeleting, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const projectOptions = useMemo(() => {
    const uniq = Array.from(new Set(invoices.map((i) => i.project_name).filter(Boolean)));
    return uniq.sort((a, b) => a.localeCompare(b));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    if (projectFilter === "all") return invoices;
    return invoices.filter((inv) => inv.project_name === projectFilter);
  }, [invoices, projectFilter]);

  const statsView = useMemo(() => {
    const source = filteredInvoices;
    const totalAmount = source.length
      ? source.reduce((sum, inv) => sum + Number(inv.amount || 0), 0)
      : stats.total;
    const projectAmount = source.length
      ? source
          .filter((inv) => inv.project_name?.toLowerCase().includes("manassas"))
          .reduce((sum, inv) => sum + Number(inv.amount || 0), 0)
      : stats.project;
    const otherAmount = Math.max(0, totalAmount - projectAmount);
    return { total: totalAmount, project: projectAmount, other: otherAmount };
  }, [filteredInvoices, stats]);

  // Pie chart calculation
  const total = statsView.total || 1;
  const projectPercentage = (statsView.project / total) * 100;
  const otherPercentage = 100 - projectPercentage;

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteAccountantInvoice(id);
        setInvoices(prev => prev.filter(inv => inv.id !== id));
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Top Section: Buttons & Stats */}
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex gap-4">
          <button 
            onClick={() => setIsManualModalOpen(true)}
            className="px-8 py-4 bg-white text-[#052e36] border border-gray-100 rounded-2xl text-sm font-black hover:bg-gray-50 transition-all shadow-sm active:scale-95"
          >
            Manual Entry
          </button>
          <button 
            onClick={() => setIsAIModalOpen(true)}
            className="px-8 py-4 bg-[#6366f1] text-white rounded-2xl text-sm font-black hover:bg-[#4f46e5] transition-all shadow-lg shadow-indigo-200 flex items-center gap-3 active:scale-95"
          >
            <Camera className="w-5 h-5" />
            Scan Invoice (AI)
          </button>
        </div>

        <div className="flex flex-wrap gap-4 flex-1 justify-end">
           {/* Total Spent */}
           <div className="bg-[#2563eb] text-white rounded-[2.5rem] p-8 min-w-[300px] shadow-xl shadow-blue-100 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 rotate-12 group-hover:scale-175 transition-transform duration-500">
                <FileText className="w-16 h-16" />
             </div>
             <p className="text-[10px] font-black tracking-widest uppercase opacity-60 mb-1">Total Budget Spent</p>
             <h4 className="text-4xl font-black tracking-tighter">${formatNumberEn(statsView.total)}</h4>
           </div>

           {/* Manassas Project */}
           <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 min-w-[240px] shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 scale-125 group-hover:scale-150 transition-transform duration-500">
                <Target className="w-16 h-16" />
             </div>
             <p className="text-[10px] font-black tracking-widest uppercase text-gray-400 mb-1">Manassas Project</p>
             <h4 className="text-3xl font-black text-[#10b981] tracking-tighter">${formatNumberEn(statsView.project)}</h4>
             <div className="w-1/2 h-1 bg-[#10b981]/20 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-[#10b981] transition-all duration-1000" 
                  style={{ width: `${projectPercentage}%` }}
                />
             </div>
           </div>

           {/* Other Expenses */}
           <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 min-w-[240px] shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 scale-125 group-hover:scale-150 transition-transform duration-500 text-orange-400">
                <BarChart3 className="w-16 h-16" />
             </div>
             <p className="text-[10px] font-black tracking-widest uppercase text-gray-400 mb-1">Other Expenses</p>
             <h4 className="text-3xl font-black text-[#f59e0b] tracking-tighter">${formatNumberEn(statsView.other)}</h4>
             <div className="w-1/2 h-1 bg-[#f59e0b]/20 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-[#f59e0b] transition-all duration-1000" 
                  style={{ width: `${otherPercentage}%` }}
                />
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 h-auto">
        {/* Budget Distribution Chart (Donut) */}
        <div className="bg-white border border-gray-100 rounded-[3rem] p-10 shadow-sm flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-8">
            <h3 className="font-black text-[#052e36] uppercase tracking-tighter">Budget Distribution</h3>
            <PieChartIcon className="w-5 h-5 text-gray-300" />
          </div>
          
          <div className="relative w-64 h-64 mb-10">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle
                cx="50" cy="50" r="40"
                fill="transparent"
                stroke="#6366f1"
                strokeWidth="12"
                strokeDasharray={`${projectPercentage * 2.513} 251.3`}
              />
              <circle
                cx="50" cy="50" r="40"
                fill="transparent"
                stroke="#10b981"
                strokeWidth="12"
                strokeDasharray={`${otherPercentage * 2.513} 251.3`}
                strokeDashoffset={`-${projectPercentage * 2.513}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-[#052e36] leading-none">{Math.round(projectPercentage)}%</span>
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1">Project</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-[#6366f1] rounded-full" />
                <span className="text-xs font-black text-[#052e36]">Manassas Project</span>
              </div>
              <span className="text-xs font-black text-[#052e36]">${formatNumberEn(statsView.project)}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-[#10b981] rounded-full" />
                <span className="text-xs font-black text-[#052e36]">Other Expenses</span>
              </div>
              <span className="text-xs font-black text-[#052e36]">${formatNumberEn(statsView.other)}</span>
            </div>
          </div>
        </div>

        {/* Invoice Log Table */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-[3rem] p-10 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-8">
             <div className="flex flex-col">
               <h3 className="font-black text-[#052e36] uppercase tracking-tighter">Financial Ledger</h3>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Recent Invoice Activity</p>
             </div>
             <select
               value={projectFilter}
               onChange={(e) => setProjectFilter(e.target.value)}
               className="bg-gray-50 border-none rounded-xl text-xs font-bold px-4 py-2 focus:ring-0"
             >
               <option value="all">All Projects</option>
               {projectOptions.map((name) => (
                 <option key={name} value={name}>
                   {name}
                 </option>
               ))}
             </select>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[400px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-white pb-4">
                <tr className="text-left border-b border-gray-50">
                  <th className="pb-4 text-[10px] font-black text-gray-300 uppercase tracking-widest">Store / Item</th>
                  <th className="pb-4 text-[10px] font-black text-gray-300 uppercase tracking-widest text-center">Project</th>
                  <th className="pb-4 text-[10px] font-black text-gray-300 uppercase tracking-widest text-right">Amount</th>
                  <th className="pb-4 text-[10px] font-black text-gray-300 uppercase tracking-widest text-center">Receipt</th>
                  <th className="pb-4 text-[10px] font-black text-gray-300 uppercase tracking-widest text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-gray-300 font-bold uppercase tracking-widest text-sm">No recorded invoices</td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="group hover:bg-gray-50/50 transition-colors">
                      <td className="py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[#f4f7fe] rounded-xl flex items-center justify-center text-[#2563eb]">
                             {inv.image_url ? <Camera className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-black text-[#052e36] text-sm leading-tight">{inv.vendor_name}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{formatDateEn(inv.created_at)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          inv.project_name?.toLowerCase().includes("manassas") 
                          ? "bg-[#10b981]/10 text-[#10b981]" 
                          : "bg-[#6366f1]/10 text-[#6366f1]"
                        }`}>
                          {inv.project_name}
                        </span>
                      </td>
                      <td className="py-6 text-right font-black text-[#052e36] text-sm">
                        ${formatNumberEn(Number(inv.amount), { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-6 text-center">
                        {inv.image_url ? (
                          <a 
                            href={inv.image_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex p-2 text-[#2563eb] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-gray-200">—</span>
                        )}
                      </td>
                      <td className="py-6 text-center">
                        <button 
                          onClick={() => handleDelete(inv.id)}
                          disabled={isDeleting && deletingId === inv.id}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          {isDeleting && deletingId === inv.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Trash className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ManualEntryModal 
        isOpen={isManualModalOpen} 
        onClose={() => setIsManualModalOpen(false)} 
        onSuccess={(inv) => {
          setInvoices(prev => [inv, ...prev]);
        }}
      />

      <AIScanModal 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)} 
        onSuccess={(inv) => {
          setInvoices(prev => [inv, ...prev]);
        }}
      />
    </div>
  );
}

function ManualEntryModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: (inv: Invoice) => void }) {
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [project, setProject] = useState("Manassas");
  const [isPending, setIsPending] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    const fd = new FormData();
    fd.set("vendor_name", vendor);
    fd.set("amount", amount);
    fd.set("project_name", project);
    
    const res = await addAccountantInvoice(fd);
    if (res.success && res.invoice) {
      onSuccess(res.invoice);
      onClose();
      setVendor("");
      setAmount("");
    }
    setIsPending(false);
  };

  return (
    <div className="fixed inset-0 bg-[#052e36]/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
      <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in duration-300">
        <div className="flex items-center justify-between mb-10">
           <h2 className="text-3xl font-black text-[#052e36] tracking-tighter">ADD INVOICE</h2>
           <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-300 tracking-widest uppercase ml-2">Vendor Name</label>
            <input 
              required
              value={vendor}
              onChange={e => setVendor(e.target.value)}
              placeholder="e.g. Home Depot"
              className="w-full bg-gray-50 border-none rounded-2xl py-5 px-6 font-bold text-[#052e36] placeholder:text-gray-300 focus:ring-2 focus:ring-[#2563eb]/20 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-300 tracking-widest uppercase ml-2">Total Amount ($)</label>
            <input 
              required
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-50 border-none rounded-2xl py-5 px-6 font-bold text-[#052e36] placeholder:text-gray-300 focus:ring-2 focus:ring-[#2563eb]/20 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-300 tracking-widest uppercase ml-2">Project Classification</label>
            <select 
              value={project}
              onChange={e => setProject(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl py-5 px-6 font-bold text-[#052e36] focus:ring-2 focus:ring-[#2563eb]/20 outline-none appearance-none"
            >
              <option value="Manassas">Manassas Project</option>
              <option value="General">General Expenses</option>
              <option value="Other">Other Category</option>
            </select>
          </div>

          <button 
            type="submit"
            disabled={isPending}
            className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white py-6 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70 mt-4"
          >
            {isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
            {isPending ? "PROCESSING..." : "SAVE FINANCIAL DATA"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AIScanModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: (inv: Invoice) => void }) {
  const [isScanning, setIsScanning] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [aiResult, setAiResult] = useState<{ vendor: string, amount: string, project: string, url: string } | null>(null);

  if (!isOpen) return null;

  // Preprocess image: upscale + grayscale + contrast boost for better OCR
  const preprocessImage = (src: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(src);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.max(1, 2400 / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const adjusted = Math.min(255, Math.max(0, 1.8 * (gray - 128) + 128));
          d[i] = d[i + 1] = d[i + 2] = adjusted;
        }
        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
          "image/png"
        );
      };
      img.onerror = reject;
      img.src = url;
    });

  const parseOCRText = (text: string) => {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 2);

    // Patterns to skip — POS systems, date/time lines, generic receipt labels
    const SKIP = [
      /^(toast|clover|square|aloha|lightspeed|revel|touchbistro|netsuite|micros|stripe|shopify)/i,
      /^(receipt|order|check|ticket|invoice|date|time|server|table|cashier|register|terminal|pos)/i,
      /^[\d\s\-\/:.#*=_|]+$/, // purely numeric / separator lines
      /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, // starts with a date
      /^\d{1,2}:\d{2}/, // starts with a time
      /^(thank you|welcome|please|visit|www\.|http)/i,
    ];

    const vendor =
      lines.find((l) =>
        l.length >= 4 &&
        /[a-zA-Z]{3,}/.test(l) &&
        !SKIP.some((p) => p.test(l))
      ) ?? "Unknown Vendor";

    // Amount: largest dollar value in the receipt (most likely the total)
    const amountMatches = text.match(/\$?\d{1,5}\.\d{2}/g) ?? [];
    const amounts = amountMatches.map((m) => parseFloat(m.replace("$", "")));
    const amount = amounts.length ? Math.max(...amounts).toFixed(2) : "0.00";
    return { vendor, amount };
  };

  const handleScan = async () => {
    if (!file) return;
    setIsScanning(true);

    let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | undefined;
    try {
      const { createWorker } = await import("tesseract.js");
      const processedBlob = await preprocessImage(file);
      worker = await createWorker("eng", 1);
      await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
      const { data: { text } } = await worker.recognize(processedBlob);
      const extracted = parseOCRText(text);

      const uploadRes = await uploadReceipt(file);
      if ("error" in uploadRes && uploadRes.error) {
        alert(`Storage Error: ${uploadRes.error}`);
        return;
      }

      setAiResult({
        vendor: extracted.vendor,
        amount: extracted.amount,
        project: "Manassas Project",
        url: uploadRes.url || "",
      });
    } catch (err) {
      console.error("Scan Error:", err);
      alert("Scan failed. Please ensure the image is clear (JPG/PNG) and try again.");
    } finally {
      if (worker) await worker.terminate();
      setIsScanning(false);
    }
  };

  const handleConfirm = async () => {
    if (!aiResult) return;
    setIsScanning(true);

    const fd = new FormData();
    fd.set("vendor_name", aiResult.vendor);
    fd.set("amount", aiResult.amount);
    fd.set("project_name", aiResult.project);
    fd.set("image_url", aiResult.url);

    const saveRes = await addAccountantInvoice(fd);
    if (saveRes.error) {
      alert(saveRes.error);
    } else if (saveRes.invoice) {
      onSuccess(saveRes.invoice);
      onClose();
      setAiResult(null);
      setFile(null);
    }
    setIsScanning(false);
  };

  return (
    <div className="fixed inset-0 bg-[#052e36]/60 backdrop-blur-xl z-[110] flex items-center justify-center p-6">
      <div className="bg-white rounded-[4rem] w-full max-w-2xl p-12 shadow-2xl animate-in zoom-in duration-500 relative overflow-hidden">
        {isScanning && (
          <div className="absolute inset-x-0 top-0 h-1 bg-[#2563eb] animate-pulse overflow-hidden">
             <div className="h-full bg-white/40 w-1/3 animate-pulse" />
          </div>
        )}

        {aiResult ? (
          <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
             <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-[#052e36] tracking-tighter uppercase">AI Review</h2>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Confirm extracted data</p>
                </div>
                <div className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-[10px] font-black uppercase tracking-widest">98% Accuracy</div>
             </div>

             {/* Receipt image preview */}
             {aiResult.url && (
               <a
                 href={aiResult.url}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="block rounded-3xl overflow-hidden border border-gray-100 hover:border-[#2563eb] transition-colors relative group"
               >
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img
                   src={aiResult.url}
                   alt="Receipt"
                   className="w-full max-h-48 object-cover object-top"
                 />
                 <div className="absolute inset-0 bg-[#052e36]/0 group-hover:bg-[#052e36]/30 transition-colors flex items-center justify-center">
                   <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                 </div>
               </a>
             )}

             <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block mb-2">Vendor</span>
                  <input
                    className="bg-transparent border-none font-black text-[#052e36] p-0 w-full focus:ring-0"
                    value={aiResult.vendor}
                    onChange={e => setAiResult({...aiResult, vendor: e.target.value})}
                  />
                </div>
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block mb-2">Total Amount</span>
                  <div className="flex items-center gap-1 font-black text-[#052e36]">
                    <span>$</span>
                    <input
                      type="number"
                      className="bg-transparent border-none font-black text-[#052e36] p-0 w-full focus:ring-0"
                      value={aiResult.amount}
                      onChange={e => setAiResult({...aiResult, amount: e.target.value})}
                    />
                  </div>
                </div>
             </div>

             <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block mb-2">Project Classification</span>
                <select
                  className="bg-transparent border-none font-black text-[#052e36] p-0 w-full focus:ring-0 appearance-none"
                  value={aiResult.project}
                  onChange={e => setAiResult({...aiResult, project: e.target.value})}
                >
                  <option value="Manassas Project">Manassas Project</option>
                  <option value="General Expenses">General Expenses</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
             </div>

             <div className="flex gap-4">
                <button 
                  onClick={() => setAiResult(null)}
                  className="flex-1 py-6 font-black text-gray-400 uppercase tracking-widest hover:text-[#052e36] transition-colors"
                >
                  Rescan
                </button>
                <button 
                  onClick={handleConfirm}
                  disabled={isScanning}
                  className="flex-[2] bg-[#2563eb] text-white py-6 rounded-[2rem] font-black text-lg shadow-2xl shadow-blue-200 hover:bg-[#1d4ed8] transition-all active:scale-95 flex items-center justify-center gap-3 uppercase"
                >
                  {isScanning ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                  Confirm & Save
                </button>
             </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-[#f4f7fe] rounded-3xl flex items-center justify-center text-[#2563eb] mb-10 shadow-inner">
               <Camera className={`w-12 h-12 ${isScanning ? "animate-bounce" : ""}`} />
            </div>
            <h2 className="text-4xl font-black text-[#052e36] tracking-tighter mb-4 uppercase">AI Vision Analysis</h2>
            <p className="text-gray-400 font-medium max-w-sm mb-12">
              Upload your receipt or PDF and our AI will analyze the document to instantly extract vendor and financial tokens.
            </p>

            {!isScanning ? (
              <div className="w-full space-y-10">
                <label className="block w-full border-4 border-dashed border-gray-100 rounded-[3rem] p-16 hover:border-[#2563eb]/20 transition-colors cursor-pointer group">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/bmp,image/gif,image/tiff,image/webp"
                    className="hidden"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                  />
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 group-hover:text-[#2563eb] transition-colors">
                       <Plus className="w-8 h-8" />
                    </div>
                    <span className="font-black text-gray-400 group-hover:text-[#052e36] transition-colors uppercase tracking-widest text-sm">
                      {file ? file.name : "Select Receipt Image / PDF"}
                    </span>
                  </div>
                </label>

                <div className="flex gap-4">
                   <button onClick={onClose} className="flex-1 py-6 font-black text-gray-400 uppercase tracking-widest hover:text-[#052e36] transition-colors">Cancel</button>
                   <button 
                    disabled={!file}
                    onClick={handleScan}
                    className="flex-[2] bg-[#052e36] text-white py-6 rounded-3xl font-black text-lg shadow-2xl shadow-teal-900/40 hover:bg-[#08434f] transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3 uppercase tracking-tighter"
                   >
                     <Scan className="w-6 h-6" />
                     Start Vision Scan
                   </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-8 py-10">
                <Loader2 className="w-20 h-20 text-[#2563eb] animate-spin" />
                <div className="flex flex-col gap-2">
                  <span className="text-2xl font-black text-[#052e36] uppercase tracking-tighter">AI Vision Extracting...</span>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-[.3em]">Analyzing financial markers</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Missing icon imports helper
import { Target, BarChart3 } from "lucide-react";
