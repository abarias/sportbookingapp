"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

const MAX_FILES = 12;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function syncFileInput(input: HTMLInputElement | null, files: File[]) {
  if (!input || typeof DataTransfer === "undefined") {
    return;
  }

  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
}

export function FacilityImageManager({ facilityName, initialImageUrls, actionState }: { facilityName: string; initialImageUrls: string[]; actionState?: unknown }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrls, setImageUrls] = useState(initialImageUrls);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);
  useEffect(() => {
    syncFileInput(fileInputRef.current, files);
  }, [actionState, files]);

  function updateFiles(nextFiles: File[]) {
    setFiles(nextFiles);
    syncFileInput(fileInputRef.current, nextFiles);
  }

  function handleFileChange(selectedFiles: File[]) {
    const invalidFile = selectedFiles.find((file) => file.size > MAX_FILE_SIZE_BYTES || !ACCEPTED_TYPES.has(file.type));

    if (invalidFile) {
      setFileError(`${invalidFile.name} is not a supported image under 5MB.`);
      return;
    }

    if (files.length + selectedFiles.length > MAX_FILES) {
      setFileError(`Select up to ${MAX_FILES} new images at a time.`);
      return;
    }

    setFileError(null);
    updateFiles([...files, ...selectedFiles]);
  }

  function moveExistingImage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= imageUrls.length) {
      return;
    }

    setImageUrls((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function moveNewImage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= files.length) {
      return;
    }

    const nextFiles = [...files];
    [nextFiles[index], nextFiles[nextIndex]] = [nextFiles[nextIndex], nextFiles[index]];
    updateFiles(nextFiles);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-stone-950/40 p-4">
      <div>
        <h3 className="font-semibold text-white">Facility images</h3>
        <p className="mt-1 text-sm text-stone-400">The first saved image is the main photo shown on the facilities listing. Reorder saved images to change it.</p>
      </div>

      {imageUrls.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {imageUrls.map((url, index) => (
            <div key={`${url}-${index}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="relative aspect-[4/3] bg-stone-900">
                <Image src={url} alt={`${facilityName || "Facility"} image ${index + 1}`} fill sizes="(max-width: 640px) 100vw, 320px" className="object-cover" />
                {index === 0 ? <span className="absolute left-3 top-3 rounded-full bg-amber-300 px-3 py-1 text-xs font-semibold text-stone-950">Main image</span> : null}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <span className="truncate text-xs text-stone-400">Saved image {index + 1}</span>
                <div className="flex gap-1">
                  <button aria-label={`Move saved image ${index + 1} earlier`} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white disabled:opacity-30" disabled={index === 0} onClick={() => moveExistingImage(index, -1)} type="button">↑</button>
                  <button aria-label={`Move saved image ${index + 1} later`} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white disabled:opacity-30" disabled={index === imageUrls.length - 1} onClick={() => moveExistingImage(index, 1)} type="button">↓</button>
                  <button aria-label={`Remove saved image ${index + 1}`} className="rounded-lg border border-rose-300/20 px-2 py-1 text-xs text-rose-200" onClick={() => setImageUrls((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-amber-300/30 bg-amber-300/5 p-4 text-sm text-amber-100">No saved images. Add at least one image before saving.</p>
      )}

      {previews.length > 0 ? (
        <div className="rounded-xl border border-dashed border-amber-300/30 bg-amber-300/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-amber-100">New images ready to upload</p>
              <p className="mt-1 text-xs text-amber-100/70">These will be added after the saved images. Arrange them before saving.</p>
            </div>
            <span className="text-xs text-amber-100/70">{previews.length}/{MAX_FILES}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {previews.map((preview, index) => (
              <div key={`${preview.file.name}-${preview.file.lastModified}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-stone-950/40 p-2">
                <Image src={preview.url} alt={preview.file.name} width={80} height={60} unoptimized className="h-14 w-20 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-white">{preview.file.name}</p>
                  <p className="mt-1 text-[11px] text-stone-500">New image {index + 1}</p>
                </div>
                <div className="flex gap-1">
                  <button aria-label={`Move new image ${index + 1} earlier`} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white disabled:opacity-30" disabled={index === 0} onClick={() => moveNewImage(index, -1)} type="button">↑</button>
                  <button aria-label={`Move new image ${index + 1} later`} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white disabled:opacity-30" disabled={index === files.length - 1} onClick={() => moveNewImage(index, 1)} type="button">↓</button>
                  <button aria-label={`Remove new image ${index + 1}`} className="rounded-lg border border-rose-300/20 px-2 py-1 text-xs text-rose-200" onClick={() => updateFiles(files.filter((_, fileIndex) => fileIndex !== index))} type="button">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <label className="block space-y-2 text-sm text-stone-200">
        <span>Add multiple images</span>
        <input
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="block w-full rounded-2xl border border-white/10 bg-stone-900/80 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:text-sm file:font-medium file:text-stone-950"
          multiple
          name="imageFiles"
          onChange={(event) => handleFileChange(Array.from(event.currentTarget.files ?? []))}
          type="file"
        />
        <span className="block text-xs text-stone-500">JPG, PNG, WEBP, or GIF. Maximum 5MB per image and {MAX_FILES} new images per save.</span>
        {fileError ? <span className="block text-sm text-rose-300">{fileError}</span> : null}
      </label>
      <textarea className="sr-only" name="imageUrls" readOnly value={imageUrls.join("\n")} />
    </section>
  );
}
