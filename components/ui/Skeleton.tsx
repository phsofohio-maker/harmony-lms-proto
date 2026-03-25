import React from 'react';
import { cn } from '../../utils';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={cn('animate-pulse bg-gray-200 rounded', className)} />
);
