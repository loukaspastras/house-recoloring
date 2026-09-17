"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const ACCEPTED = ["image/jpeg", "image/png"];
const MAX_BYTES = 15 * 1024 * 1024;

interface UploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  error?: string | null;
}

export function UploadZone({ onFile, disabled, error }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!ACCEPTED.includes(file.type)) {
        setValidationError("Please upload a JPEG or PNG image.");
        return;
      }
      if (file.size === 0) {
        setValidationError("That file appears to be empty.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setValidationError("Image exceeds the 15 MB limit.");
        return;
      }
      setValidationError(null);
      onFile(file);
    },
    [onFile],
  );

  const message = validationError ?? error;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-20 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <UploadCloud className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
        Recolor your house walls in seconds
      </h1>
      <p className="mt-3 max-w-lg text-neutral-600">
        Upload a photo of your home. AI identifies the paintable walls once, then you can
        recolor them in real time — shadows and textures stay perfectly intact.
      </p>

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "mt-10 flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-14 transition-colors",
          dragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-neutral-300 bg-white hover:border-indigo-300 hover:bg-neutral-50",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {disabled ? (
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        ) : (
          <UploadCloud className="h-8 w-8 text-neutral-400" />
        )}
        <span className="text-sm font-medium text-neutral-700">
          Drag &amp; drop a photo, or <span className="text-indigo-600">browse</span>
        </span>
        <span className="text-xs text-neutral-400">JPEG or PNG · up to 15 MB</span>
      </button>

      {message && <p className="mt-4 text-sm font-medium text-red-600">{message}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
