import * as React from 'react';
import { Upload } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { parseGpx } from '@/lib/gpx';
import { cn } from '@/lib/cn';

export function FileDrop() {
  const setTrace = useAppStore((s) => s.setTrace);
  const [over, setOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const trace = parseGpx(text);
      setTrace(trace);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fichier illisible');
    }
  };

  return (
    <div className="space-y-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) await handleFile(f);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          over
            ? 'border-blue-700 bg-blue-50 text-blue-900'
            : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100',
        )}
      >
        <Upload className="h-6 w-6" />
        <div className="font-medium text-slate-800">Glisser un fichier .gpx ici</div>
        <div className="text-xs">ou cliquer pour parcourir</div>
        <input
          type="file"
          accept=".gpx,application/gpx+xml,application/xml"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await handleFile(f);
          }}
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
