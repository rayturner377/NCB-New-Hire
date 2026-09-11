import { StyleSheet } from '@react-pdf/renderer';

/**
 * Shared styling for the exported assessment (see medical-assessment-document.tsx
 * and its section sub-components) — modeled directly on the paper NCB
 * Pre-Employment Medical Assessment form's own look: black-bordered boxes,
 * a black header bar for the report title, and real bordered grid cells
 * rather than plain spaced-out text, so a printed copy reads the same way
 * the original does. One place so every section stays visually consistent.
 */
export const pdfStyles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 44, fontSize: 8, fontFamily: 'Helvetica', color: '#111111' },

  // Page 1 header: logo placeholder + date, then the black title bar.
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  logoPlaceholder: {
    width: 130,
    height: 46,
    border: '1pt dashed #999999',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoPlaceholderText: { fontSize: 7, color: '#999999', textAlign: 'center' },
  logoImage: { width: 130, height: 46, objectFit: 'contain' },
  dateField: { fontSize: 9 },
  reportTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 6 },
  bannerBar: {
    backgroundColor: '#000000',
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    textAlign: 'center',
    paddingVertical: 3,
    letterSpacing: 0.5
  },

  // A bordered box wrapping a whole section (the black-bordered rectangles the paper form uses
  // for the name/contact grid, the disclosure/consent block, the signature strip, etc).
  box: { border: '1pt solid #000000' },
  boxDivider: { borderTop: '1pt solid #000000' },

  // A grid row inside a `box` — cells separated by vertical rules, like the paper form's table.
  gridRow: { flexDirection: 'row', borderTop: '1pt solid #000000' },
  gridRowFirst: { flexDirection: 'row' },
  gridCell: { flex: 1, padding: 5, borderLeft: '1pt solid #000000' },
  gridCellFirst: { flex: 1, padding: 5 },
  gridCellLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 3, color: '#333333' },
  gridCellValue: { fontSize: 8.5 },

  sectionSpacing: { marginTop: 10 },
  heading: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    paddingBottom: 3,
    borderBottom: '0.75pt solid #000000',
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  subheading: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginTop: 5, marginBottom: 2, textDecoration: 'underline' },

  // A compact multi-column list for short answers — the fix for a page that was mostly blank
  // space next to a one-word "Yes"/"No".
  columns: { flexDirection: 'row', gap: 14 },
  column: { flex: 1, flexDirection: 'column' },
  fieldRow: { flexDirection: 'row', marginBottom: 2.5 },
  fieldLabel: { fontFamily: 'Helvetica-Bold', marginRight: 4 },
  fieldValue: { flex: 1 },

  // "Label: answer" written on a ruled line rather than plain text — matches the exam page's own
  // "Nose: __________" look, and reads as an actual fill-in-the-blank even when there's no answer.
  underlineFieldRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 5, marginRight: 10 },
  underlineLabel: { fontFamily: 'Helvetica-Bold', marginRight: 4 },
  underlineValue: { flex: 1, borderBottom: '0.75pt solid #666666', paddingBottom: 1, minHeight: 10 },

  // A single full-width row for values that can run long (free-text conclusions/notes), where a
  // narrow column would force awkward wrapping.
  wideFieldRow: { flexDirection: 'row', marginBottom: 3 },
  wideFieldLabel: { fontFamily: 'Helvetica-Bold', width: 120, flexShrink: 0 },
  wideFieldValue: { flex: 1 },
  wideFieldBlock: { marginBottom: 6 },
  wideFieldBlockLabel: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  wideFieldBlockBox: { border: '0.75pt solid #999999', minHeight: 30, padding: 4 },

  bullet: { marginLeft: 8, marginBottom: 1 },

  // Checkbox — a small bordered square, filled solid when checked, next to its own label.
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2.5, marginRight: 10 },
  checkboxLabel: { marginRight: 4 },
  checkbox: { width: 8, height: 8, border: '0.75pt solid #000000', marginRight: 3 },
  checkboxChecked: { backgroundColor: '#000000' },
  checkboxDetail: { marginLeft: 4, fontStyle: 'italic' },

  consentBox: { border: '1pt solid #000000', padding: 8, marginBottom: 6 },
  consentSectionHeading: { fontFamily: 'Helvetica-Bold', fontSize: 9, textAlign: 'center', marginTop: 6, marginBottom: 4 },
  consentParagraph: { marginBottom: 6, lineHeight: 1.4, fontSize: 8 },
  consentSignatureImage: { width: 140, height: 45, objectFit: 'contain', marginTop: 4 },
  boldRun: { fontFamily: 'Helvetica-Bold' },

  signatureBlock: { flexDirection: 'row', gap: 16, marginTop: 6 },
  signatureBox: { flex: 1 },
  signatureImage: { width: 150, height: 50, objectFit: 'contain', marginTop: 3, marginBottom: 3 },
  signatureLine: { borderBottom: '1pt solid #999999', width: 190, height: 50, marginTop: 3, marginBottom: 3 },
  stampBox: {
    width: 150,
    height: 80,
    border: '1pt dashed #999999',
    marginTop: 3,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stampBoxLabel: { fontSize: 7.5, color: '#888888', textAlign: 'center' },
  footerNote: { fontSize: 7, color: '#888888', marginTop: 4 }
});
