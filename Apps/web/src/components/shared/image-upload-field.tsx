import { useRef } from "react";
import { Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useUploadImage } from "@/hooks/useMedia";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  IMAGE_MAX_UPLOAD_BYTES,
  type ImagePurpose,
} from "@dragon-telecom/contract";

interface ImageUploadFieldProps {
  /** Currently stored URL, or undefined when nothing is set yet. */
  value?: string;
  purpose: ImagePurpose;
  /** Fired with the processed main-image URL after a successful upload. The caller persists it. */
  onUploaded: (url: string) => void;
  label: string;
  /** Helper text beneath the control — the caller supplies an already-translated string. */
  hint?: string;
  disabled?: boolean;
  /** Tailwind size classes for the preview box; defaults to a 20x20 square. */
  previewClassName?: string;
  /** Icon-only button, no label/preview/hint — used inline in compact rows (HierarchyPanel). */
  compact?: boolean;
}

// S26.1 — one reusable upload control, used for the store logo, the print logo, brand logos and
// family icons. No remove/clear action: nothing in this set asks to unset a logo, and the
// contract's `.optional()` fields cannot express "clear" through a PATCH that ignores
// `undefined` — this is a deliberate omission, not a gap.
export function ImageUploadField({
  value,
  purpose,
  onUploaded,
  label,
  hint,
  disabled = false,
  previewClassName,
  compact = false,
}: ImageUploadFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadImage();

  const handleClick = () => {
    if (!disabled && !uploadImage.isPending) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    const maxMb = IMAGE_MAX_UPLOAD_BYTES / (1024 * 1024);
    if (file.size > IMAGE_MAX_UPLOAD_BYTES) {
      toast.error(t("common.media.tooLarge", { max: maxMb }));
      return;
    }

    uploadImage.mutate(
      { file, purpose },
      {
        onSuccess: (result) => {
          onUploaded(result.url);
          toast.success(t("common.media.uploadSuccess"));
        },
      },
    );
  };

  const isPending = uploadImage.isPending;
  const buttonLabel = isPending
    ? t("common.media.uploading")
    : value
      ? t("common.media.replace")
      : t("common.media.upload");

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")}
      onChange={handleChange}
      className="hidden"
      disabled={disabled || isPending}
    />
  );

  if (compact) {
    return (
      <>
        {input}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClick}
          disabled={disabled || isPending}
          aria-label={label}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {input}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center overflow-hidden rounded-md border bg-muted",
            previewClassName ?? "h-20 w-20",
          )}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={disabled || isPending}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {buttonLabel}
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
