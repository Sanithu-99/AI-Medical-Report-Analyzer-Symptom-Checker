import { useRef, useState } from "react";
import clsx from "clsx";
import { ArrowPathIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";

export default function UploadBox({
  onUpload,
  uploading = false,
  variant = "default",
  className = "",
}) {
  const inputRef = useRef(null);
  const [selectionSummary, setSelectionSummary] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const summarizeFiles = (files) => {
    if (files.length === 0) return "";
    if (files.length === 1) return files[0].name;
    return `${files[0].name} + ${files.length - 1} more`;
  };

  const handleFilesSelect = async (fileList) => {
    const files = Array.from(fileList ?? []).filter(Boolean);
    if (files.length === 0) return;
    setSelectionSummary(summarizeFiles(files));
    if (onUpload) {
      await onUpload(files);
    }
  };

  const handleFileChange = async (event) => {
    await handleFilesSelect(event.target.files);
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    } else if (event.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    await handleFilesSelect(event.dataTransfer?.files);
  };

  const isCompact = variant === "compact";
  const containerClasses = clsx(
    "relative overflow-hidden rounded-3xl border border-dashed border-teal/30 bg-white/90 shadow-soft transition backdrop-blur",
    isCompact ? "p-6" : "p-8",
    dragActive && "border-teal/60 bg-white",
    uploading && "opacity-80",
    className
  );

  return (
    <div
      className={containerClasses}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-4 text-center text-ocean sm:flex-row sm:items-start sm:text-left">
        <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl border border-sand/70 bg-sky">
          {uploading ? (
            <ArrowPathIcon className="h-7 w-7 animate-spin text-teal" />
          ) : (
            <CloudArrowUpIcon className="h-7 w-7 text-teal" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-ocean">Drag & drop reports or select files</p>
          <p className="text-xs text-ocean/60">
            Supports PDF, PNG, or JPEG. Documents stay encrypted—only you and your team can access the results.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-ocean/40">
            <span className="rounded-full border border-sand/70 px-3 py-1">PDF</span>
            <span className="rounded-full border border-sand/70 px-3 py-1">PNG</span>
            <span className="rounded-full border border-sand/70 px-3 py-1">JPEG</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "Select files"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      {selectionSummary && (
        <p className="mt-4 text-xs text-ocean/50">
          Last selected: <span className="font-medium text-ocean">{selectionSummary}</span>
        </p>
      )}
      <div className="mt-5 rounded-2xl border border-white/80 bg-white/70 p-3 text-[11px] leading-relaxed text-ocean/60">
        <p className="font-semibold text-ocean/80">HIPAA safeguards</p>
        <p>
          PHI is anonymised and tokenised before leaving your browser. Only de-identified text is stored and every
          download requires a signed URL.
        </p>
      </div>
      {dragActive && (
        <span className="pointer-events-none absolute inset-0 rounded-3xl border-2 border-teal/50" />
      )}
    </div>
  );
}
