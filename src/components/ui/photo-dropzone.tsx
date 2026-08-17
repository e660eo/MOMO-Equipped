"use client";

import { ImagePlus, UploadCloud } from "lucide-react";
import { useDropzone, type FileRejection } from "react-dropzone";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function rejectionMessage(rejections: FileRejection[]) {
  if (rejections.some(({ errors }) => errors.some(({ code }) => code === "file-too-large"))) {
    return "Файл больше 20 МБ — уменьшите размер снимка.";
  }
  if (rejections.some(({ errors }) => errors.some(({ code }) => code === "file-invalid-type"))) {
    return "Поддерживаются JPG, PNG и WEBP. Фото HEIC сначала сохраните как JPG.";
  }
  return "Не удалось добавить выбранные файлы. Проверьте их формат и размер.";
}

export function PhotoDropzone({
  disabled = false,
  onFiles,
  onError,
}: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onError: (message: string) => void;
}) {
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    disabled,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    onDropAccepted: (files) => onFiles(files),
    onDropRejected: (rejections) => onError(rejectionMessage(rejections)),
  });

  const stateClass = isDragReject
    ? "border-[var(--signal-text)] bg-red-500/5"
    : isDragAccept
      ? "border-signal bg-signal/10 shadow-[inset_0_0_0_1px_var(--color-signal)]"
      : isDragActive
        ? "border-signal bg-signal/5"
        : "border-border bg-surface hover:border-signal hover:bg-signal/[0.03]";

  return (
    <div
      {...getRootProps()}
      className={`group mt-4 flex min-h-[164px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-5 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/35 focus-visible:ring-offset-2 ${stateClass} ${
        disabled ? "pointer-events-none cursor-wait opacity-55" : ""
      }`}
    >
      <input {...getInputProps()} />
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
          isDragActive
            ? "border-signal bg-signal text-white"
            : "border-border bg-tile text-signal group-hover:border-signal"
        }`}
      >
        {isDragActive ? <UploadCloud size={21} /> : <ImagePlus size={21} />}
      </div>

      <p className="mt-3 text-[0.86rem] font-semibold">
        {disabled
          ? "Фотография обрабатывается…"
          : isDragReject
            ? "Этот файл не подходит"
            : isDragActive
              ? "Отпустите, чтобы добавить"
              : "Перетащите фотографии сюда"}
      </p>
      {!disabled && !isDragActive && (
        <p className="mt-1 text-[0.74rem] text-muted-foreground">
          или <span className="font-semibold text-signal underline decoration-signal/40 underline-offset-2">выберите файлы</span>
        </p>
      )}
      <p className="mt-3 text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
        JPG · PNG · WEBP&nbsp;&nbsp;·&nbsp;&nbsp;до 20 МБ
      </p>
    </div>
  );
}
