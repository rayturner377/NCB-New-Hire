'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import type { CasePdfExportProps } from './case-pdf-export-inner';

/**
 * Public entry point for "Export as PDF" — a thin dynamic-import wrapper
 * around the real component (case-pdf-export-inner.tsx). `ssr: false` is
 * required here, not optional: @react-pdf/renderer's <PDFDownloadLink>
 * doesn't work correctly when server-rendered (the export button silently
 * does nothing on click), and skipping the server render also means its
 * bundle isn't part of this page's initial load — it only downloads once
 * this component actually mounts.
 */
const CasePdfExportInner = dynamic(() => import('./case-pdf-export-inner').then((mod) => mod.CasePdfExportInner), {
  ssr: false,
  loading: () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Export</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">Loading export tools…</p>
      </CardContent>
    </Card>
  )
});

export type { CasePdfExportProps } from './case-pdf-export-inner';

export function CasePdfExport(props: CasePdfExportProps) {
  return <CasePdfExportInner {...props} />;
}
