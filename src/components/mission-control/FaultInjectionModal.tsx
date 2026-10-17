import { useState } from "react";
import {
  SatelliteTelemetry,
  FAILURE_TYPES,
  FailureType,
  FailureSeverity,
} from "../../data/mockMissionControl";
import { X, AlertTriangle, Loader2 } from "lucide-react";

interface FaultInjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  satellites: SatelliteTelemetry[];
  onInject: (targetId: string, type: FailureType, severity: FailureSeverity) => Promise<boolean | void> | void;
}

export default function FaultInjectionModal({
  isOpen,
  onClose,
  satellites,
  onInject,
}: FaultInjectionModalProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>("SAT-04");
  const [selectedType, setSelectedType] = useState<FailureType>("Propulsion Failure");
  const [selectedSeverity, setSelectedSeverity] = useState<FailureSeverity>("MODERATE");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await onInject(selectedTarget, selectedType, selectedSeverity);
      if (result === false) {
        // If handler returned false indicating failure
        setErrorMessage("Fault injection was rejected by simulation engine.");
      } else {
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to inject fault";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none font-sans text-xs">
      <div className="w-full max-w-sm bg-[#080D15] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="font-medium text-sm text-white">
              Inject Satellite Fault
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded text-[#7F8C9A] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[11px]">
              {errorMessage}
            </div>
          )}

          {/* Target Satellite */}
          <div>
            <label className="text-[11px] text-[#7F8C9A] block mb-1.5 font-medium">
              Target Satellite
            </label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              disabled={isSubmitting}
              className="w-full p-2 rounded-lg bg-white/[0.04] border border-white/10 text-white focus:border-[#5C9FD6] outline-none cursor-pointer text-xs disabled:opacity-50"
            >
              {satellites.map((sat) => (
                <option key={sat.id} value={sat.id} className="bg-[#080D15] text-white">
                  {sat.name} ({sat.plane} · {sat.role})
                </option>
              ))}
            </select>
          </div>

          {/* Failure Type */}
          <div>
            <label className="text-[11px] text-[#7F8C9A] block mb-1.5 font-medium">
              Failure Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as FailureType)}
              disabled={isSubmitting}
              className="w-full p-2 rounded-lg bg-white/[0.04] border border-white/10 text-white focus:border-[#5C9FD6] outline-none cursor-pointer text-xs disabled:opacity-50"
            >
              {FAILURE_TYPES.map((type) => (
                <option key={type} value={type} className="bg-[#080D15] text-white">
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Severity Control */}
          <div>
            <label className="text-[11px] text-[#7F8C9A] block mb-1.5 font-medium">
              Severity Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["MINOR", "MODERATE", "CRITICAL"] as FailureSeverity[]).map(
                (sev) => (
                  <button
                    key={sev}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setSelectedSeverity(sev)}
                    className={`py-1.5 rounded-lg border text-center transition-colors cursor-pointer text-xs disabled:opacity-50 ${
                      selectedSeverity === sev
                        ? "bg-white/10 border-white/20 text-white font-medium"
                        : "bg-white/[0.02] border-white/6 text-[#7F8C9A] hover:text-white"
                    }`}
                  >
                    {sev.charAt(0) + sev.slice(1).toLowerCase()}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg border border-white/10 text-[#7F8C9A] hover:text-white transition-colors cursor-pointer text-xs disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 border border-[#F59E0B]/30 text-[#F59E0B] font-medium transition-colors cursor-pointer text-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isSubmitting ? "Injecting…" : "Inject Fault"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
