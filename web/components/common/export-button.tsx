"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, datestampedFilename, type CsvColumn } from "@/lib/csv";

export function ExportCsvButton<T>({
  rows,
  columns,
  filenamePrefix,
  label = "CSV",
  disabled,
}: {
  rows: T[];
  columns: CsvColumn<T>[];
  filenamePrefix: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || rows.length === 0}
      onClick={() =>
        downloadCsv(datestampedFilename(filenamePrefix), rows, columns)
      }
      title={rows.length === 0 ? "Nichts zu exportieren" : `${rows.length} Zeilen`}
    >
      <Download size={13} />
      {label}
    </Button>
  );
}
