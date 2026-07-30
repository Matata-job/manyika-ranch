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
    <div className={cn("flex flex-wrap gap-2", className)}>
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
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
