import { Image, Text, View } from '@react-pdf/renderer';
import { pdfStyles } from './pdf-styles';

export interface PdfHeaderSectionProps {
  /** The large logo configured under Settings → General (settings-service.ts's getSettings().general.largeLogoDataUrl) — falls back to the dashed placeholder box when nothing's been uploaded yet. */
  logoUrl?: string;
}

/**
 * Page 1's own header: the org's logo (top-left) and a print date
 * (top-right), then the report title and a "Personal Information" banner
 * introducing the employee/candidate details grid that follows.
 */
export function PdfHeaderSection({ logoUrl }: PdfHeaderSectionProps) {
  return (
    <View>
      <View style={pdfStyles.topRow}>
        {logoUrl ? (
          <Image src={logoUrl} style={pdfStyles.logoImage} />
        ) : (
          <View style={pdfStyles.logoPlaceholder}>
            <Text style={pdfStyles.logoPlaceholderText}>Logo{'\n'}130 x 46</Text>
          </View>
        )}
        <Text style={pdfStyles.dateField}>Date: {new Date().toLocaleDateString()}</Text>
      </View>

      <Text style={pdfStyles.reportTitle}>Employee Medical Report</Text>
      <View style={[pdfStyles.bannerBar, { marginBottom: 8 }]}>
        <Text>Personal Information</Text>
      </View>
    </View>
  );
}
