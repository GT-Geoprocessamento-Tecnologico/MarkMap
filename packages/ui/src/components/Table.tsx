import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import { cx } from '../lib/cx';

export type TableProps = TableHTMLAttributes<HTMLTableElement>;

export function Table({ className, ...rest }: TableProps) {
  return <table className={cx('gn-table', className)} {...rest} />;
}

export type TableHeaderProps = HTMLAttributes<HTMLTableSectionElement>;

export function TableHeader({ className, ...rest }: TableHeaderProps) {
  return <thead className={cx('gn-table__head', className)} {...rest} />;
}

export type TableBodyProps = HTMLAttributes<HTMLTableSectionElement>;

export function TableBody({ className, ...rest }: TableBodyProps) {
  return <tbody className={cx('gn-table__body', className)} {...rest} />;
}

export type TableRowProps = HTMLAttributes<HTMLTableRowElement>;

export function TableRow({ className, ...rest }: TableRowProps) {
  return <tr className={cx('gn-table__row', className)} {...rest} />;
}

export type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement>;

export function TableHead({ className, ...rest }: TableHeadProps) {
  return <th className={cx('gn-table__head-cell', className)} {...rest} />;
}

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement>;

export function TableCell({ className, ...rest }: TableCellProps) {
  return <td className={cx('gn-table__cell', className)} {...rest} />;
}
