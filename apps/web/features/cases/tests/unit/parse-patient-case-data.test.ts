import { describe, expect, it } from 'vitest';
import { parsePatientCaseData } from '../../parse-patient-case-data';

function formData(entries: Array<[string, string]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe('parsePatientCaseData', () => {
  it('parses personal info, trimming values and dropping blank emails/phones', () => {
    const data = parsePatientCaseData(
      formData([
        ['personalInfo.firstName', '  Jane  '],
        ['personalInfo.lastName', 'Doe'],
        ['personalInfo.email', 'jane@ncb.local'],
        ['personalInfo.email', ''],
        ['personalInfo.contactNumber', '+18761234567'],
        ['personalInfo.contactNumberType', 'Mobile'],
        ['personalInfo.contactNumber', ''],
        ['personalInfo.contactNumberType', 'Home']
      ])
    );

    expect(data.personalInfo.firstName).toBe('Jane');
    expect(data.personalInfo.emails).toEqual(['jane@ncb.local']);
    expect(data.personalInfo.phones).toEqual([{ type: 'Mobile', number: '+18761234567' }]);
  });

  it('parses dateOfBirth and nationalId, trimmed', () => {
    const data = parsePatientCaseData(
      formData([
        ['personalInfo.dateOfBirth', '1990-01-15'],
        ['personalInfo.nationalId', '  123-456-789  ']
      ])
    );
    expect(data.personalInfo.dateOfBirth).toBe('1990-01-15');
    expect(data.personalInfo.nationalId).toBe('123-456-789');
  });

  it('defaults a phone entry with no type to Mobile', () => {
    const data = parsePatientCaseData(formData([['personalInfo.contactNumber', '+18760000000']]));
    expect(data.personalInfo.phones).toEqual([{ type: 'Mobile', number: '+18760000000' }]);
  });

  it('zips parallel family-relative arrays back into row objects in order', () => {
    const data = parsePatientCaseData(
      formData([
        ['familyRelative.relative', 'Mother'],
        ['familyRelative.relative', 'Father'],
        ['familyRelative.ageIfAlive', '65'],
        ['familyRelative.ageIfAlive', ''],
        ['familyRelative.healthOrCauseOfDeath', 'Good health'],
        ['familyRelative.healthOrCauseOfDeath', 'Heart attack'],
        ['familyRelative.ageAtDeath', ''],
        ['familyRelative.ageAtDeath', '58']
      ])
    );

    expect(data.familyHistory.relatives).toEqual([
      { relative: 'Mother', ageIfAlive: '65', healthOrCauseOfDeath: 'Good health', ageAtDeath: '' },
      { relative: 'Father', ageIfAlive: '', healthOrCauseOfDeath: 'Heart attack', ageAtDeath: '58' }
    ]);
  });

  it('reads every family disorder catalog item by its own field names', () => {
    const data = parsePatientCaseData(formData([['disorder.diabetes.answer', 'yes'], ['disorder.diabetes.who', 'Mother']]));
    expect(data.familyHistory.disorders.diabetes).toEqual({ answer: 'yes', who: 'Mother' });
    // An item never submitted still gets a row, just blank.
    expect(data.familyHistory.disorders.cancer).toEqual({ answer: '', who: '' });
  });

  it('reads every medical disease catalog item by its own field names', () => {
    const data = parsePatientCaseData(formData([['disease.diabetes.answer', 'yes'], ['disease.diabetes.year', '2020']]));
    expect(data.medicalHistory.diseases.diabetes).toEqual({ answer: 'yes', year: '2020' });
  });

  it('parses a text/textarea question with only a detail field, no answer/extra', () => {
    const data = parsePatientCaseData(formData([['question.otherHealthInfo.detail', 'Nothing else to report']]));
    expect(data.medicalHistory.questions.otherHealthInfo).toEqual({ answer: '', detail: 'Nothing else to report' });
  });

  it('parses a yesno question with extra fields', () => {
    const data = parsePatientCaseData(
      formData([
        ['question.smoking.answer', 'yes'],
        ['question.smoking.detail', 'Cigarettes'],
        ['question.smoking.extra.yearsSmoked', '10'],
        ['question.smoking.extra.frequencyPerDay', '5']
      ])
    );

    expect(data.medicalHistory.questions.smoking).toEqual({
      answer: 'yes',
      detail: 'Cigarettes',
      extra: { yearsSmoked: '10', frequencyPerDay: '5' }
    });
  });

  it('parses a yesno question with no extra fields as an empty extra object', () => {
    const data = parsePatientCaseData(formData([['question.currentTreatment.answer', 'no']]));
    expect(data.medicalHistory.questions.currentTreatment).toEqual({ answer: 'no', detail: '', extra: {} });
  });

  it('treats consent.accepted as true only when the checkbox field is present at all', () => {
    const accepted = parsePatientCaseData(formData([['consent.accepted', 'on']]));
    const notAccepted = parsePatientCaseData(formData([]));
    expect(accepted.consent.accepted).toBe(true);
    expect(notAccepted.consent.accepted).toBe(false);
  });
});
