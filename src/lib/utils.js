import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind class lists, later classes winning conflicts. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
