"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Html5Qrcode } from "html5-qrcode";
import { getTransferForReceiving, receiveTransfer, type ReceivingTransferPayload } from "@/app/(dashboard)/branch/[id]/orders/scan/actions";
import { formatNumberEn } from "@/lib/format/en";
import { ArrowLeft, Camera, Check, Flashlight, FlashlightOff, RefreshCw, ScanLine } from "lucide-react";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseTransferIdFromQr(text: string): string | null {
  const t = String(text).trim();
  if (UUID_RE.test(t)) return t;
  return null;
}

const readerId = "nya-order-scan-reader";
const minQrBox = 200;
const minQrBoxMobile = 220;

type CameraInfo = { id: string; label: string };

export function OrderScanView({ branchId, branchName }: { branchId: string; branchName: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"scan" | "form">("scan");
  const [payload, setPayload] = useState<ReceivingTransferPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scanConsumedRef = useRef(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const instRef = useRef<Html5Qrcode | null>(null);
  const camListRef = useRef<CameraInfo[]>([]);
  const camIndexRef = useRef(0);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [torchOn, setTorchOn] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const stopScan = useCallback(async () => {
    const h = instRef.current;
    if (h?.isScanning) {
      try {
        await h.stop();
        await h.clear();
      } catch {
        // ignore
      }
    }
    setScanActive(false);
  }, []);

  const startWithDevice = useCallback(
    async (deviceId: string) => {
      if (typeof window === "undefined") return;
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!instRef.current) {
        instRef.current = new Html5Qrcode(readerId, { verbose: false });
      }
      const h = instRef.current;
      if (h.isScanning) {
        try {
          await h.stop();
        } catch {
          // ignore
        }
      }
      const w = Math.min(
        minQrBoxMobile,
        Math.max(minQrBox, typeof window !== "undefined" ? Math.min(window.innerWidth - 32, 320) : minQrBox),
      );
      await h.start(
        deviceId,
        { fps: 12, qrbox: { width: w, height: w } },
        (decoded) => {
          if (scanConsumedRef.current) return;
          const tid = parseTransferIdFromQr(decoded);
          if (!tid) return;
          scanConsumedRef.current = true;
          void (async () => {
            await stopScan();
            setLoadError(null);
            const res = await getTransferForReceiving(tid, branchId);
            setPhase("form");
            if ("error" in res) {
              setLoadError(res.error);
              setPayload(null);
            } else {
              setLoadError(null);
              setPayload(res.data);
              const next: Record<string, string> = {};
              for (const it of res.data.items) {
                next[it.transferItemId] = String(it.quantitySent);
              }
              setQty(next);
            }
          })();
        },
        () => {
          // frame-level scan noise; no-op
        },
      );
      setScanActive(true);
    },
    [branchId, stopScan],
  );

  const loadCamerasAndStart = useCallback(async () => {
    if (typeof window === "undefined") return;
    const { Html5Qrcode } = await import("html5-qrcode");
    const list = await Html5Qrcode.getCameras();
    const mapped: CameraInfo[] = list.map((c) => ({ id: c.id, label: c.label || "Camera" }));
    camListRef.current = mapped;
    setCameras(mapped);
    if (mapped.length === 0) {
      setLoadError("No camera was found. Allow camera access and try again.");
      return;
    }
    const idx = Math.min(camIndexRef.current, mapped.length - 1);
    const deviceId = mapped[idx]!.id;
    await startWithDevice(deviceId);
  }, [startWithDevice]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || phase !== "scan") return;
    void loadCamerasAndStart();
    return () => {
      void stopScan();
    };
  }, [hydrated, phase, loadCamerasAndStart, stopScan]);

  const switchCamera = useCallback(async () => {
    const list = camListRef.current;
    if (list.length < 2) return;
    camIndexRef.current = (camIndexRef.current + 1) % list.length;
    setTorchOn(false);
    await startWithDevice(list[camIndexRef.current]!.id);
  }, [startWithDevice]);

  const toggleTorch = useCallback(async () => {
    const h = instRef.current;
    if (!h?.isScanning) return;
    try {
      const next = !torchOn;
      // torch is not in standard TypeScript types; some Android Chrome builds support it
      await h.applyVideoConstraints({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        advanced: [{ torch: next } as any],
      } as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchOn(false);
    }
  }, [torchOn]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload) return;
    setSubmitError(null);
    const lines: { transfer_item_id: string; quantity_received: number }[] = [];
    for (const it of payload.items) {
      const raw = qty[it.transferItemId];
      const n = raw === undefined || raw === "" ? NaN : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        setSubmitError("Enter a valid quantity (zero or greater) for every line.");
        return;
      }
      lines.push({ transfer_item_id: it.transferItemId, quantity_received: n });
    }
    const fd = new FormData();
    fd.set("to_branch_id", branchId);
    fd.set("transfer_id", payload.id);
    fd.set("lines_json", JSON.stringify(lines));

    startTransition(async () => {
      const res = await receiveTransfer(fd);
      if ("error" in res) {
        setSubmitError(res.error);
        return;
      }
      const q = res.status === "disputed" ? "disputed" : "ok";
      router.push(`/branch/${branchId}/warehouse?receipt=${q}`);
    });
  };

  const resetToScan = async () => {
    scanConsumedRef.current = false;
    setPayload(null);
    setLoadError(null);
    setSubmitError(null);
    setPhase("scan");
  };

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto w-full px-1">
      {phase === "scan" && (
        <>
          <p className="text-sm text-slate-600 text-center">
            Point the camera at the shipment label QR. It encodes the transfer ID for{" "}
            <span className="font-bold text-[#052e36]">{branchName}</span>.
          </p>
          <div
            id={readerId}
            className="w-full min-h-[260px] rounded-3xl overflow-hidden bg-black/90 border border-slate-800 shadow-inner"
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void toggleTorch()}
              disabled={!scanActive}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-800 disabled:opacity-40"
            >
              {torchOn ? <FlashlightOff className="w-4 h-4" /> : <Flashlight className="w-4 h-4" />}
              {torchOn ? "Light off" : "Flashlight"}
            </button>
            <button
              type="button"
              onClick={() => void switchCamera()}
              disabled={cameras.length < 2}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-800 disabled:opacity-40"
            >
              <Camera className="w-4 h-4" />
              Switch camera
            </button>
            <button
              type="button"
              onClick={async () => {
                setLoadError(null);
                await stopScan();
                void loadCamerasAndStart();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600"
            >
              <RefreshCw className="w-4 h-4" />
              Restart
            </button>
          </div>
        </>
      )}

      {phase === "form" && (
        <form onSubmit={onSubmit} className="space-y-6">
          {loadError && !payload && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-red-900 bg-red-50 border border-red-100 rounded-2xl px-4 py-3" role="alert">
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => void resetToScan()}
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#2563eb]"
              >
                <ScanLine className="w-4 h-4" />
                Scan again
              </button>
            </div>
          )}

          {payload && (
            <>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Receive at</p>
                <p className="font-black text-[#052e36]">{payload.destinationName}</p>
                <p className="text-xs text-slate-500 mt-1">Status when scanned: in transit (confirm received quantities below)</p>
              </div>

              <ul className="space-y-3">
                {payload.items.map((it) => (
                  <li
                    key={it.transferItemId}
                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-[#052e36] text-sm leading-tight">{it.ingredientName}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                        {it.unit}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Sent:{" "}
                      <span className="font-mono font-bold text-slate-800">
                        {formatNumberEn(it.quantitySent, { maximumFractionDigits: 3 })}
                      </span>
                    </p>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Quantity received
                      <input
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-[#052e36]"
                        value={qty[it.transferItemId] ?? ""}
                        onChange={(e) => setQty((prev) => ({ ...prev, [it.transferItemId]: e.target.value }))}
                        disabled={isPending}
                      />
                    </label>
                  </li>
                ))}
              </ul>

              {submitError && (
                <p className="text-sm text-red-900 bg-red-50 border border-red-100 rounded-2xl px-4 py-3" role="alert">
                  {submitError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void resetToScan()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-600"
                >
                  <ScanLine className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#052e36] px-5 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isPending ? "Saving…" : "Confirm receipt"}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      <div className="pt-2">
        <Link
          href={`/branch/${branchId}/orders`}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#052e36]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to orders
        </Link>
      </div>
    </div>
  );
}
