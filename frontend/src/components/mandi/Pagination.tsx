import { Button } from '../ui/Button';
import styles from './Pagination.module.css';

/**
 * The page controls of the observations table.
 *
 * The backend caps a page and reports how many records match, so the
 * controls only ever offer a page that exists.
 */

export type PaginationProps = {
  /** The page that is shown, counted from zero. */
  page: number;
  /** The number of pages the results need. */
  pageCount: number;
  /** The number of observations that match the filters. */
  total: number;
  /** True while the page is being fetched. */
  loading?: boolean;
  onChange: (page: number) => void;
};

export function Pagination({
  page,
  pageCount,
  total,
  loading = false,
  onChange,
}: PaginationProps) {
  const records = total === 1 ? 'record' : 'records';

  return (
    <nav className={styles.pagination} aria-label="Price observation pages">
      <p className={styles.status}>
        {loading
          ? 'Loading page ' + (page + 1) + ' of ' + pageCount + '...'
          : total + ' ' + records + ' match the filters. Page ' + (page + 1) + ' of ' + pageCount + '.'}
      </p>

      <div className={styles.buttons}>
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 0}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pageCount - 1}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
