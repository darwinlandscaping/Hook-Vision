import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Camera, Upload, X, Fish } from "lucide-react";
import { Button } from "@/components/ui/button";

async function identifyFish(file: File): Promise<unknown> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch("/api/fish-id", { method: "POST", body: form });
  if (!res.ok) throw new Error("Fish ID failed");
  return res.json();
}

export default function FishId() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () => identifyFish(file!),
  });

  function handleFile(f: File) {
    setFile(f);
    mutation.reset();
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  }

  function handleClear() {
    setFile(null);
    setPreview(null);
    mutation.reset();
    if (inputRef.current) inputRef.current.value = "";
  }

  const result = mutation.data as Record<string, unknown> | null | undefined;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
          Catch ID
        </h1>
        <p className="text-sm" style={{ color: "hsl(195 44% 60%)" }}>
          Upload a photo of your catch — AI identifies the species and checks regulations
        </p>
      </div>

      {!preview ? (
        <div
          className="rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors"
          style={{ borderColor: "hsl(216 56% 28%)", backgroundColor: "hsl(216 56% 11%)" }}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          data-testid="dropzone-upload"
        >
          <Camera size={40} className="mx-auto mb-3" style={{ color: "hsl(168 100% 42% / 0.5)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "hsl(195 44% 80%)", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>
            Drop a photo or click to upload
          </p>
          <p className="text-xs" style={{ color: "hsl(195 44% 50%)" }}>JPG, PNG, HEIC up to 10MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid="input-image-upload"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-lg overflow-hidden" style={{ border: "1px solid hsl(216 56% 25%)" }}>
            <img src={preview} alt="Catch preview" className="w-full max-h-72 object-contain" style={{ backgroundColor: "hsl(216 60% 7%)" }} />
            <button
              onClick={handleClear}
              data-testid="button-clear-image"
              className="absolute top-2 right-2 p-1 rounded"
              style={{ backgroundColor: "hsl(216 56% 20%)", color: "hsl(195 44% 80%)" }}
            >
              <X size={16} />
            </button>
          </div>

          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            data-testid="button-identify"
            className="w-full"
            style={{ backgroundColor: "hsl(168 100% 42%)", color: "hsl(216 60% 10%)", fontFamily: "'Oswald', sans-serif" }}
          >
            <Upload size={16} className="mr-2" />
            {mutation.isPending ? "Identifying..." : "Identify Catch"}
          </Button>
        </div>
      )}

      {mutation.isPending && (
        <div className="rounded-lg p-6 text-center" style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(216 56% 20%)" }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Fish size={18} style={{ color: "hsl(168 100% 42%)" }} className="animate-pulse" />
            <span className="text-sm font-medium" style={{ color: "hsl(195 44% 80%)", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase" }}>
              Analysing your catch...
            </span>
          </div>
          <p className="text-xs" style={{ color: "hsl(195 44% 55%)" }}>Checking species, size and regulations</p>
        </div>
      )}

      {mutation.isError && (
        <div className="rounded-lg p-5" style={{ backgroundColor: "hsl(0 40% 15%)", border: "1px solid hsl(0 60% 30%)" }}>
          <p className="text-sm" style={{ color: "hsl(0 84% 70%)" }}>
            Identification failed. Try a clearer photo with the fish visible against a plain background.
          </p>
        </div>
      )}

      {result && (
        <div
          className="rounded-lg p-5 space-y-4"
          style={{ backgroundColor: "hsl(216 56% 13%)", border: "1px solid hsl(168 100% 42% / 0.3)" }}
          data-testid="card-fish-result"
        >
          <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "hsl(168 100% 42%)", fontFamily: "'Oswald', sans-serif" }}>
            Identification Result
          </div>

          {Object.entries(result).map(([key, value]) => {
            if (value === null || value === undefined || value === "") return null;
            const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
            const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);

            return (
              <div key={key} className="flex flex-col gap-0.5">
                <span className="text-xs uppercase font-medium" style={{ color: "hsl(195 44% 55%)", fontFamily: "'Oswald', sans-serif", letterSpacing: "0.08em" }}>
                  {label}
                </span>
                <span className="text-sm" style={{ color: "hsl(195 44% 88%)" }}>{displayValue}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
