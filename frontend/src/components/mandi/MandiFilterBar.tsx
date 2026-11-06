import { useId, useState } from 'react';

import type { DashboardFilters } from '../../lib/useMandiDashboard';
import { Button } from '../ui/Button';
import { DateField, SelectField, TextField } from '../ui/FormField';
import styles from './MandiFilterBar.module.css';

/**
 * The filter bar of the price dashboard.
 *
 * The dropdowns apply as soon as they change. The crop field is free text,
 * because a data source may publish a commodity this project does not know
 * yet, so it is only applied once the farmer finishes typing it. That keeps
 * one request per finished value instead of one per keystroke.
 */

export type MandiFilterBarProps = {
  values: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  /** The crops the platform knows about. */
  cropOptions: Array<{ slug: string; name: string }>;
  stateOptions: string[];
  districtOptions: string[];
  marketOptions: Array<{ slug: string; name: string }>;
  onReset: () => void;
};

export function MandiFilterBar({
  values,
  onChange,
  cropOptions,
  stateOptions,
  districtOptions,
  marketOptions,
  onReset,
}: MandiFilterBarProps) {
  const cropListId = useId();
  const [cropDraft, setCropDraft] = useState(values.crop);
  const [lastAppliedCrop, setLastAppliedCrop] = useState(values.crop);

  // The applied crop can change from outside this field, for example when
  // the filters are cleared. The draft follows it during the render rather
  // than from an effect, so the field never shows a stale value.
  if (values.crop !== lastAppliedCrop) {
    setLastAppliedCrop(values.crop);
    setCropDraft(values.crop);
  }

  function commitCrop() {
    const next = cropDraft.trim();
    if (next === values.crop) return;
    onChange({ ...values, crop: next });
  }

  const activeFilters = [
    values.crop,
    values.state,
    values.district,
    values.market,
    values.from,
    values.to,
  ].filter((value) => value.trim() !== '').length;

  return (
    <form
      className={styles.form}
      aria-label="Filter mandi prices"
      onSubmit={(event) => {
        event.preventDefault();
        commitCrop();
      }}
    >
      <div className={styles.grid}>
        <TextField
          label="Crop or commodity"
          hint="Type a crop, or pick one from the list."
          value={cropDraft}
          onChange={setCropDraft}
          onCommit={commitCrop}
          list={cropListId}
          placeholder="Wheat"
        />

        <SelectField
          label="State"
          value={values.state}
          options={stateOptions.map((state) => ({ value: state, label: state }))}
          onChange={(state) => onChange({ ...values, state })}
          placeholder="All states"
        />

        <SelectField
          label="District"
          value={values.district}
          options={districtOptions.map((district) => ({
            value: district,
            label: district,
          }))}
          onChange={(district) => onChange({ ...values, district })}
          placeholder="All districts"
        />

        <SelectField
          label="Market"
          value={values.market}
          options={marketOptions.map((market) => ({
            value: market.slug,
            label: market.name,
          }))}
          onChange={(market) => onChange({ ...values, market })}
          placeholder="All markets"
        />

        <DateField
          label="Observed from"
          value={values.from}
          onChange={(from) => onChange({ ...values, from })}
          max={values.to || undefined}
        />

        <DateField
          label="Observed until"
          value={values.to}
          onChange={(to) => onChange({ ...values, to })}
          min={values.from || undefined}
        />
      </div>

      <datalist id={cropListId}>
        {cropOptions.map((option) => (
          <option key={option.slug} value={option.name} />
        ))}
      </datalist>

      <div className={styles.actions}>
        <p className={styles.summary} role="status">
          {activeFilters === 0
            ? 'No filters applied, so every recorded price is shown.'
            : activeFilters === 1
              ? '1 filter applied.'
              : activeFilters + ' filters applied.'}
        </p>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Clear filters
        </Button>
      </div>
    </form>
  );
}
