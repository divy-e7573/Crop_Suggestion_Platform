import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { ApiRequestError } from '../../lib/apiClient';
import {
  postFarmProfile,
  type FarmProfileAnalysisDto,
  type ProfileDataStatus,
} from '../../lib/farmProfileApi';
import {
  EMPTY_FARM_PROFILE,
  FARM_PROFILE_FIELDS,
  IRRIGATION_TYPE_OPTIONS,
  LAND_AREA_UNIT_OPTIONS,
  SEASON_OPTIONS,
  SOIL_TYPE_OPTIONS,
  STATE_SUGGESTIONS,
  toFarmProfileRequest,
  validateFarmProfile,
  type FarmProfileField,
  type FarmProfileValues,
} from '../../lib/farmProfileValidation';
import { Button } from '../ui/Button';
import { RadioGroup, SelectField, TextField } from '../ui/FormField';
import { StateMessage } from '../ui/StateMessage';
import { StatusBadge } from '../ui/StatusBadge';
import styles from './FarmProfileForm.module.css';

/** The id of the datalist that offers state suggestions. */
const STATE_LIST_ID = 'farm-profile-state-suggestions';

/** Maps the API's data status onto the design system's status badge. */
const STATUS_BADGE: Record<ProfileDataStatus, 'live' | 'recent' | 'demo' | 'unavailable'> = {
  LIVE: 'live',
  RECENT: 'recent',
  DEMO: 'demo',
  UNAVAILABLE: 'unavailable',
};

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

type FieldErrors = Partial<Record<FarmProfileField, string>>;

/**
 * The farmer profile form (PRD FR-02).
 *
 * The browser checks the values first, so the farmer gets an answer without
 * waiting for the network, but the server checks them again before anything is
 * stored (AGENTS.md section 5). Values are never cleared when a request
 * fails, so a farmer does not have to type the form a second time.
 *
 * Crop suggestions and selling-period insights are not shown here. That is the
 * Phase 8 rule engine, and the API says so in its own response, so an empty
 * list is never shown as if no crop suited the farm.
 */
export function FarmProfileForm() {
  const [values, setValues] = useState<FarmProfileValues>({ ...EMPTY_FARM_PROFILE });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<FormStatus>('idle');
  const [result, setResult] = useState<FarmProfileAnalysisDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  /** Moves the keyboard to the first field that still has a problem. */
  function focusFirstInvalid() {
    const form = formRef.current;
    if (!form) return;
    const target = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    target?.focus();
  }

  /** Keeps one field up to date, and re-checks it after the first attempt. */
  function updateField(field: FarmProfileField, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    if (hasSubmitted) {
      setErrors(validateFarmProfile(next));
    }
  }

  /** Sends the profile to the API and records what came back. */
  async function submitProfile() {
    setHasSubmitted(true);
    setFormError(null);

    const found = validateFarmProfile(values);
    setErrors(found);

    if (Object.keys(found).length > 0) {
      setStatus('error');
      setFormError('Some details still need attention. The highlighted fields must be fixed.');
      focusFirstInvalid();
      return;
    }

    setStatus('submitting');

    try {
      const response = await postFarmProfile(toFarmProfileRequest(values));
      setResult(response);
      setStatus('success');
      setErrors({});
    } catch (error) {
      setStatus('error');

      if (error instanceof ApiRequestError) {
        // The API reports which field failed, so the message can be shown
        // next to the input that caused it.
        const fieldErrors: FieldErrors = {};
        for (const detail of error.details) {
          const field = detail.field as FarmProfileField;
          if (FARM_PROFILE_FIELDS.includes(field) && fieldErrors[field] === undefined) {
            fieldErrors[field] = detail.message;
          }
        }
        setErrors(fieldErrors);
        setFormError(error.message);
        if (Object.keys(fieldErrors).length > 0) {
          focusFirstInvalid();
        }
        return;
      }

      setFormError('The profile could not be saved. Please try again.');
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitProfile();
  }

  /** Clears the form so a different farm can be entered. */
  function handleStartAgain() {
    setValues({ ...EMPTY_FARM_PROFILE });
    setErrors({});
    setResult(null);
    setFormError(null);
    setStatus('idle');
    setHasSubmitted(false);
  }

  if (status === 'success' && result) {
    return (
      <div className={styles.stack}>
        <div className={styles.successPanel} role="status">
          <p className={styles.successTitle}>Your profile was saved</p>
          <p className={styles.notice}>{result.notice}</p>

          <dl className={styles.summary}>
            <div>
              <dt className={styles.summaryTerm}>Location</dt>
              <dd className={styles.summaryValue}>
                {result.profile.district}, {result.profile.state}
                {result.profile.villageOrPin ? ' - ' + result.profile.villageOrPin : ''}
              </dd>
            </div>
            <div>
              <dt className={styles.summaryTerm}>Land</dt>
              <dd className={styles.summaryValue}>
                {result.profile.landArea} {result.profile.landAreaUnit.toLowerCase()}
                {' (' + result.profile.landAreaInAcres + ' acres)'}
              </dd>
            </div>
            <div>
              <dt className={styles.summaryTerm}>Soil type</dt>
              <dd className={styles.summaryValue}>{result.profile.soilType}</dd>
            </div>
            <div>
              <dt className={styles.summaryTerm}>Season</dt>
              <dd className={styles.summaryValue}>{result.profile.season}</dd>
            </div>
            <div>
              <dt className={styles.summaryTerm}>Irrigation</dt>
              <dd className={styles.summaryValue}>
                {result.profile.irrigationType ?? 'Not given'}
              </dd>
            </div>
            <div>
              <dt className={styles.summaryTerm}>Current crop</dt>
              <dd className={styles.summaryValue}>{result.profile.currentCrop ?? 'Not given'}</dd>
            </div>
          </dl>

          <div className={styles.metaRow}>
            <StatusBadge status={STATUS_BADGE[result.matchingData.dataStatus]} />
            <span className={styles.notice}>{result.matchingData.notice}</span>
          </div>

          <dl className={styles.summary}>
            <div>
              <dt className={styles.summaryTerm}>Matching price records</dt>
              <dd className={styles.summaryValue}>{result.matchingData.priceObservations}</dd>
            </div>
            <div>
              <dt className={styles.summaryTerm}>Relevant markets</dt>
              <dd className={styles.summaryValue}>{result.matchingData.markets}</dd>
            </div>
          </dl>

          {!result.matchingData.isComplete ? (
            <p className={styles.notice}>
              Only part of the data source could be read, so these counts may be lower than
              the real total.
            </p>
          ) : null}

          <p className={styles.notice}>{result.analysis.message}</p>
          <p className={styles.reference}>Profile reference: {result.profileId}</p>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={handleStartAgain}>
            Enter another profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} ref={formRef} onSubmit={handleSubmit} noValidate>
      <div className={styles.fieldGrid}>
        <TextField
          label="State"
          required
          value={values.state}
          onChange={(value) => updateField('state', value)}
          placeholder="For example, Maharashtra"
          hint="Type your state, or pick one from the list."
          list={STATE_LIST_ID}
          error={errors.state}
        />

        <TextField
          label="District"
          required
          value={values.district}
          onChange={(value) => updateField('district', value)}
          placeholder="For example, Nashik"
          hint="The district your farm is in."
          error={errors.district}
        />

        <TextField
          label="Village or PIN code"
          value={values.villageOrPin}
          onChange={(value) => updateField('villageOrPin', value)}
          placeholder="Optional"
          hint="Optional. A village name, or a PIN code with exactly 6 digits."
          error={errors.villageOrPin}
        />

        <SelectField
          label="Soil type"
          required
          value={values.soilType}
          onChange={(value) => updateField('soilType', value)}
          placeholder="Choose a soil type"
          options={SOIL_TYPE_OPTIONS}
          error={errors.soilType}
        />

        <SelectField
          label="Season"
          required
          value={values.season}
          onChange={(value) => updateField('season', value)}
          placeholder="Choose a season"
          options={SEASON_OPTIONS}
          error={errors.season}
        />

        <SelectField
          label="Irrigation"
          value={values.irrigationType}
          onChange={(value) => updateField('irrigationType', value)}
          placeholder="Choose an option (optional)"
          options={IRRIGATION_TYPE_OPTIONS}
          hint="Optional. Leave it blank if you do not irrigate."
          error={errors.irrigationType}
        />

        <TextField
          label="Current or intended crop"
          value={values.currentCrop}
          onChange={(value) => updateField('currentCrop', value)}
          placeholder="Optional"
          hint="Optional. For example, Soybean or Wheat."
          error={errors.currentCrop}
        />
      </div>

      <div className={styles.fieldRow}>
        <TextField
          label="Land area"
          required
          value={values.landArea}
          onChange={(value) => updateField('landArea', value)}
          inputMode="decimal"
          placeholder="For example, 2.5"
          hint="How much land you farm."
          error={errors.landArea}
        />

        <RadioGroup
          label="Land area unit"
          required
          value={values.landAreaUnit}
          onChange={(value) => updateField('landAreaUnit', value)}
          options={LAND_AREA_UNIT_OPTIONS}
          error={errors.landAreaUnit}
        />
      </div>

      <datalist id={STATE_LIST_ID}>
        {STATE_SUGGESTIONS.map((state) => (
          <option key={state} value={state} />
        ))}
      </datalist>

      {status === 'error' && formError ? (
        <StateMessage
          kind="error"
          title="Your profile was not saved"
          detail={formError}
          onRetry={() => void submitProfile()}
        />
      ) : null}

      <div className={styles.actions}>
        <Button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Saving your profile...' : 'Save my profile'}
        </Button>
        {status === 'submitting' ? (
          <span className={styles.pending} role="status">
            Sending your details to the server.
          </span>
        ) : null}
      </div>
    </form>
  );
}

