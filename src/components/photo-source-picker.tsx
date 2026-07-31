"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, ImagePlus } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

interface PhotoSourcePickerProps {
  /** Called with selected files from gallery or camera */
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
}

/** Visually hidden but still openable on mobile (display:none breaks some WebViews). */
const fileInputClass =
  "absolute h-px w-px overflow-hidden opacity-0 pointer-events-none";

/**
 * Two clear options: pick from device library, or open the camera.
 * Separate inputs are required — combining capture + gallery on one input
 * makes many phones only offer the camera.
 */
export function PhotoSourcePicker({
  onFiles,
  multiple = true,
  disabled = false,
  className,
  size = "sm",
}: PhotoSourcePickerProps) {
  const t = useT();
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length) onFiles(files);
  }

  return (
    <div className={cn("relative flex flex-wrap gap-2", className)}>
      <input
        ref={libraryRef}
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif"
        multiple={multiple}
        className={fileInputClass}
        tabIndex={-1}
        aria-hidden
        onChange={handleChange}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={fileInputClass}
        tabIndex={-1}
        aria-hidden
        onChange={handleChange}
      />
      <Button
        type="button"
        size={size}
        variant="outline"
        disabled={disabled}
        onClick={() => libraryRef.current?.click()}
      >
        <ImagePlus className="h-4 w-4 mr-1.5" />
        {t("chooseFromDevice")}
      </Button>
      <Button
        type="button"
        size={size}
        variant="outline"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
      >
        <Camera className="h-4 w-4 mr-1.5" />
        {t("takePhoto")}
      </Button>
    </div>
  );
}
