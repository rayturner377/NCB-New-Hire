import { Image, Text, View } from '@react-pdf/renderer';
import { PdfField } from './pdf-primitives';
import { pdfStyles } from './pdf-styles';

export interface PdfSignatureBlockProps {
  signedBy: string | undefined;
  signedAt: string | undefined;
  signatureDataUrl: string | undefined;
  /** Only the physician's signature gets a stamp box — a patient never stamps anything. */
  showStampBox?: boolean;
}

/**
 * One signature, consistently presented wherever it appears (the patient's
 * consent, the physician's attestation): the actual drawn/typed signature
 * image if one was captured, else a blank line ready for a pen; who signed
 * and the full date/time/timezone they signed at (see
 * lib/signature-timestamp.ts — the point of capturing all three is exactly
 * for a printed, physically-signed copy like this one). The stamp box is a
 * plain dashed rectangle — there's no digital stamp to render, it's just
 * reserved space for a real rubber stamp once this is printed.
 */
export function PdfSignatureBlock({ signedBy, signedAt, signatureDataUrl, showStampBox }: PdfSignatureBlockProps) {
  return (
    <View style={pdfStyles.signatureBlock} wrap={false}>
      <View style={pdfStyles.signatureBox}>
        <Text style={pdfStyles.fieldLabel}>Signature</Text>
        {signatureDataUrl ? (
          <Image src={signatureDataUrl} style={pdfStyles.signatureImage} />
        ) : (
          <View style={pdfStyles.signatureLine} />
        )}
        <PdfField label="Signed by" value={signedBy} />
        <PdfField label="Signed at" value={signedAt} />
      </View>
      {showStampBox ? (
        <View style={pdfStyles.signatureBox}>
          <Text style={pdfStyles.fieldLabel}>Official stamp</Text>
          <View style={pdfStyles.stampBox}>
            <Text style={pdfStyles.stampBoxLabel}>Physician's stamp{'\n'}(if applicable)</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
