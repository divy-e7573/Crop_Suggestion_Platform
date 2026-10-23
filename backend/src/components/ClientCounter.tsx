'use client';

import { useState } from 'react';

/**
 * A tiny Client Component used only to demonstrate the Server/Client boundary.
 *
 * Because of the `use client` directive at the top of this file, React ships
 * JavaScript for this component to the browser and it can hold state. The rest
 * of the page stays a Server Component and ships none.
 */
export function ClientCounter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>
        This counter is a <strong>Client Component</strong>, so the browser runs its
        state. Click it and watch the value change without a page reload.
      </p>
      <p>
        <button
          className="button"
          type="button"
          onClick={() => setCount((current) => current + 1)}
        >
          Clicked {count} {count === 1 ? 'time' : 'times'}
        </button>
      </p>
    </div>
  );
}
