import { useState } from 'react';

import { Card } from '../components/ui/Card';
import { SelectField, TextField } from '../components/ui/FormField';
import { StateMessage } from '../components/ui/StateMessage';
import styles from './pages.module.css';

const SOIL_OPTIONS = [
  { value: 'alluvial', label: 'Alluvial' },
  { value: 'black', label: 'Black (regur)' },
  { value: 'red', label: 'Red' },
  { value: 'laterite', label: 'Laterite' },
  { value: 'sandy', label: 'Sandy' },
  { value: 'other', label: 'Other' },
];

const SEASON_OPTIONS = [
  { value: 'kharif', label: 'Kharif' },
  { value: 'rabi', label: 'Rabi' },
  { value: 'zaid', label: 'Zaid' },
  { value: 'other', label: 'Other' },
];

/**
 * Crop suggestion section.
 *
 * The fields below are a design-system preview. They accept input and validate the
 * way the real form will, but nothing is submitted because the analysis endpoint
 * does not exist yet (Phase 6). No submit button is shown, so no control on this page
 * pretends to work.
 */
export function CropSuggestionsPage() {
  const [soilType, setSoilType] = useState('');
  const [season, setSeason] = useState('');
  const [district, setDistrict] = useState('');
  const [landArea, setLandArea] = useState('');
  const [sampleValue, setSampleValue] = useState('');

  return (
    <div className={styles.stack}>
      <header className={styles.pageHeader}>
        <h1>Crop suggestions</h1>
        <p className={styles.lead}>
          Suggestions come from a documented rule set matched against your location,
          soil type, season, land area, and irrigation. Every suggestion shows the
          reason behind it, and nothing is guaranteed.
        </p>
      </header>

      <Card
        title="Design-system preview"
        description="Interactive inputs used by the farmer profile form. Not yet connected to the API."
        aside={<span className={styles.phaseTag}>Phase 2 preview</span>}
      >
        <div className={styles.grid}>
          <SelectField
            label="District"
            required
            value={district}
            onChange={setDistrict}
            placeholder="Choose a district"
            options={[
              { value: 'nashik', label: 'Nashik' },
              { value: 'ludhiana', label: 'Ludhiana' },
              { value: 'anantapur', label: 'Anantapur' },
            ]}
            hint="State and district text entry will be supported in Phase 6."
          />

          <SelectField
            label="Soil type"
            required
            value={soilType}
            onChange={setSoilType}
            placeholder="Choose a soil type"
            options={SOIL_OPTIONS}
          />

          <SelectField
            label="Season"
            required
            value={season}
            onChange={setSeason}
            placeholder="Choose a season"
            options={SEASON_OPTIONS}
          />

          <TextField
            label="Land area"
            required
            value={landArea}
            onChange={setLandArea}
            inputMode="decimal"
            placeholder="For example, 2.5"
            hint="Used with the unit selector in the final form."
          />
        </div>
        <p className={styles.placeholder}>
          No submit button is shown on purpose. The analysis endpoint is built in
          Phase 6, so submitting here would only pretend to work.
        </p>

        {/*
          Sample control for the error variant of a field. It is an ordinary,
          editable input so nothing on this page is inert; the message below it is
          a fixed style sample and is not produced by a validation rule. Real rules
          arrive in Phase 6.
        */}
        <div className={styles.grid}>
          <TextField
            label="Sample field showing the error style"
            required
            value={sampleValue}
            onChange={setSampleValue}
            placeholder="Type anything"
            hint="Hints and errors can appear together."
            error="Style preview of the error state, not a real validation result."
          />
        </div>
      </Card>

      <Card title="Suggestions" description="Ranked crops with their reasons">
        <StateMessage
          kind="empty"
          title="No suggestions yet"
          detail="The crop suitability rules are built in Phase 8. Suggestions always show the inputs that influenced them and never promise a yield or profit."
        />
      </Card>
    </div>
  );
}
