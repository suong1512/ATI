"use client";

import { useRef, useState } from "react";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/uploadConfig";
import { formatBytes } from "@/lib/format";

export type UploadStatus = "idle" | "processing" | "done" | "error";

type UploadBoxProps = {
  file: File | null;
  status: UploadStatus;
  onFileSelected: (file: File) => void;
  onUpload: () => void;
  onReset: () => void;
};

export default function UploadBox({ file, status, onFileSelected, onUpload, onReset }: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const busy = status === "processing";

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFileSelected(dropped);
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>1. Chọn file hóa đơn</h2>
        <StatusPill status={status} />
      </div>

      <div
        className={`dropzone${isDragging ? " active" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
      >
        <strong>Kéo &amp; thả file vào đây, hoặc bấm để chọn</strong>
        <span>
          Hỗ trợ PDF, PNG, JPEG — tối đa {Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB
        </span>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={ACCEPTED_MIME_TYPES.join(",")}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) onFileSelected(selected);
            event.target.value = "";
          }}
        />
      </div>

      {file ? (
        <div className="file-meta">
          Đã chọn: <strong>{file.name}</strong> ({formatBytes(file.size)})
        </div>
      ) : null}

      <div className="actions">
        <button type="button" className="btn-primary" disabled={!file || busy} onClick={onUpload}>
          {busy ? "Đang xử lý..." : "Tải lên & trích xuất"}
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={onReset}>
          Xoá lựa chọn
        </button>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: UploadStatus }) {
  const labels: Record<UploadStatus, string> = {
    idle: "Chờ file",
    processing: "Đang gọi API",
    done: "Đã trích xuất",
    error: "Có lỗi",
  };
  return <span className={`pill pill-${status}`}>{labels[status]}</span>;
}
