import { Text, View } from '@react-pdf/renderer';
import { pdfStyles } from './pdf-styles';

export interface PdfFieldItem {
  label: string;
  value: unknown;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && value !== false;
}

function displayValue(value: unknown): string {
  return value === true ? 'Yes' : String(value);
}

/** A full-width "Label: value" row — for a short answer that isn't part of a yes/no or blank-line group. */
export function PdfField({ label, value }: PdfFieldItem) {
  if (!hasValue(value)) return null;
  return (
    <View style={pdfStyles.wideFieldRow} wrap={false}>
      <Text style={pdfStyles.wideFieldLabel}>{label}</Text>
      <Text style={pdfStyles.wideFieldValue}>{displayValue(value)}</Text>
    </View>
  );
}

/** Label above a bordered box — for a paragraph-length answer (conclusions, lab notes), matching the paper form's own boxed "CONCLUSIONS"/"LABORATORY" areas. Still renders the (empty) box when there's no answer yet, since the box itself is part of the form's layout, not conditional content. */
export function PdfBoxedFreeText({ label, value }: PdfFieldItem) {
  return (
    <View style={pdfStyles.wideFieldBlock} wrap={false}>
      <Text style={pdfStyles.wideFieldBlockLabel}>{label}</Text>
      <View style={pdfStyles.wideFieldBlockBox}>
        <Text>{hasValue(value) ? displayValue(value) : ''}</Text>
      </View>
    </View>
  );
}

export interface PdfFieldColumnsProps {
  items: PdfFieldItem[];
  columns?: 2 | 3;
}

/** Splits a list of short label/value pairs into side-by-side columns instead of one full-width row each. Items are dealt round-robin across columns so a long list balances evenly. */
export function PdfFieldColumns({ items, columns = 2 }: PdfFieldColumnsProps) {
  const visible = items.filter((item) => hasValue(item.value));
  if (visible.length === 0) return null;

  const columnItems: PdfFieldItem[][] = Array.from({ length: columns }, () => []);
  visible.forEach((item, index) => columnItems[index % columns]?.push(item));

  return (
    <View style={pdfStyles.columns} wrap={false}>
      {columnItems.map((items, columnIndex) => (
        <View key={columnIndex} style={pdfStyles.column}>
          {items.map((item, itemIndex) => (
            <View key={itemIndex} style={pdfStyles.fieldRow} wrap={false}>
              <Text style={pdfStyles.fieldLabel}>{item.label}:</Text>
              <Text style={pdfStyles.fieldValue}>{displayValue(item.value)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** A label sitting over a ruled line, the value written on it (or left blank) — the exam page's own "Nose: __________" look, which reads as a real fill-in-the-blank even with nothing filled in yet. */
export function PdfUnderlineField({ label, value }: PdfFieldItem) {
  return (
    <View style={pdfStyles.underlineFieldRow} wrap={false}>
      <Text style={pdfStyles.underlineLabel}>{label}:</Text>
      <Text style={pdfStyles.underlineValue}>{hasValue(value) ? displayValue(value) : ' '}</Text>
    </View>
  );
}

export interface PdfUnderlineColumnsProps {
  items: PdfFieldItem[];
  columns?: 2 | 3;
}

/** Groups PdfUnderlineField entries into side-by-side columns — for a system's several short findings (e.g. Nose/Pharynx/Teeth) shown on the same line, matching the exam page's own row groupings. Renders every item regardless of whether it has a value, since the blank line itself is the point. */
export function PdfUnderlineColumns({ items, columns = 2 }: PdfUnderlineColumnsProps) {
  const columnItems: PdfFieldItem[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, index) => columnItems[index % columns]?.push(item));

  return (
    <View style={pdfStyles.columns} wrap={false}>
      {columnItems.map((items, columnIndex) => (
        <View key={columnIndex} style={pdfStyles.column}>
          {items.map((item, itemIndex) => (
            <PdfUnderlineField key={itemIndex} label={item.label} value={item.value} />
          ))}
        </View>
      ))}
    </View>
  );
}

export interface PdfCheckboxItem {
  label: string;
  checked: boolean;
  /** Shown after the label when checked (a year, a "who") — omitted for an unchecked item, matching "no describe box when the answer is No". */
  detail?: string;
}

function PdfCheckbox({ label, checked, detail }: PdfCheckboxItem) {
  return (
    <View style={pdfStyles.checkboxRow} wrap={false}>
      <View style={[pdfStyles.checkbox, checked ? pdfStyles.checkboxChecked : undefined]} />
      <Text style={pdfStyles.checkboxLabel}>{label}</Text>
      {checked && detail ? <Text style={pdfStyles.checkboxDetail}>({detail})</Text> : null}
    </View>
  );
}

export interface PdfCheckboxColumnsProps {
  items: PdfCheckboxItem[];
  columns?: 2 | 3 | 4;
}

/** A checked/unchecked square next to each item's label, arranged in columns — the paper form's own questionnaire style for every yes/no disclosure (family disorders, disease history), rather than writing out the word "Yes"/"No". */
export function PdfCheckboxColumns({ items, columns = 3 }: PdfCheckboxColumnsProps) {
  const columnItems: PdfCheckboxItem[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, index) => columnItems[index % columns]?.push(item));

  return (
    <View style={pdfStyles.columns} wrap={false}>
      {columnItems.map((items, columnIndex) => (
        <View key={columnIndex} style={pdfStyles.column}>
          {items.map((item, itemIndex) => (
            <PdfCheckbox key={itemIndex} label={item.label} checked={item.checked} detail={item.detail} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** A full black bar, white bold centered text — reserved for the form's own major page-part dividers ("Personal Information", "Family History", "Completed by Physician"), matching exactly how the paper form marks those, not used for every minor sub-heading. */
export function PdfBannerHeading({ children }: { children: React.ReactNode }) {
  return (
    <View style={pdfStyles.sectionSpacing}>
      <View style={pdfStyles.bannerBar}>
        <Text>{children}</Text>
      </View>
    </View>
  );
}

/** A plain bold heading with a thin rule under it — every other section title (Medical history, Disclosure and Consent, Determination, ...) that the paper form doesn't set off with a full black bar. */
export function PdfSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <View style={pdfStyles.sectionSpacing}>
      <Text style={pdfStyles.heading}>{children}</Text>
    </View>
  );
}

export interface PdfGridCellDef {
  label: string;
  value: unknown;
  /** Relative width within its row — defaults to 1 (even split); use e.g. 2 for a wider cell like "Address". */
  weight?: number;
}

/** A bordered box of label/value cells laid out in rows — the paper form's own "NAME / ADDRESS", "DATE OF BIRTH / SEX / MARITAL STATUS / EMPLOYEE ID" style grids, each cell boxed rather than just spaced text. */
export function PdfGridBox({ rows }: { rows: PdfGridCellDef[][] }) {
  return (
    <View style={pdfStyles.box} wrap={false}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={rowIndex === 0 ? pdfStyles.gridRowFirst : pdfStyles.gridRow}>
          {row.map((cell, cellIndex) => (
            <View
              key={cellIndex}
              style={[cellIndex === 0 ? pdfStyles.gridCellFirst : pdfStyles.gridCell, { flex: cell.weight ?? 1 }]}
            >
              <Text style={pdfStyles.gridCellLabel}>{cell.label}</Text>
              <Text style={pdfStyles.gridCellValue}>{hasValue(cell.value) ? displayValue(cell.value) : ' '}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function PdfSubheading({ children }: { children: React.ReactNode }) {
  return <Text style={pdfStyles.subheading}>{children}</Text>;
}

export function humanizeKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}
