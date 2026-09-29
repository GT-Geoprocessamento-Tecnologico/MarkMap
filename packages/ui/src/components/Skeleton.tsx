import type { HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...rest }: SkeletonProps) {
  return <div aria-hidden="true" className={cx('gn-skeleton', className)} {...rest} />;
}
