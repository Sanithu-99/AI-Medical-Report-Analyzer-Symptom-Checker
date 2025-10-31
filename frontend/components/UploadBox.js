import { useRef, useState } from "react";
import { CloudArrowUpIcon } from "@heroicons/react/24/outline";

export default function UploadBox({ onUpload, uploading = false }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (onUpload) {
      await onUpload(file);
    }
  };

  return (
    <div className="glass gradient-border relative overflow-hidden p-8 flex flex-col items-center text-center">
      <div className="h-16 w-16 rounded-2xl bg-soft-gray flex items-center justify-center mb-4">
        <CloudArrowUpIcon className="h-8 w-8 text-midnight" />
      </div>
      <h3 className="text-xl font-semibold mb-2">Upload your medical report</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-md">
        Supports PDF, PNG, or JPEG. Our AI automatically extracts key details and insights in seconds.
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-full px-6 py-3 bg-midnight text-white text-sm font-medium shadow-lg shadow-midnight/20 transition hover:shadow-midnight/40 disabled:opacity-70"
        disabled={uploading}
      >
        {uploading ? "Uploading..." : "Choose File"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg"
        className="hidden"
        onChange={handleFileChange}
      />
      {fileName && <p className="mt-4 text-xs text-gray-600">Selected: {fileName}</p>}
    </div>
  );
}
