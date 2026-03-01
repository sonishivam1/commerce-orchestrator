import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn() — the canonical shadcn/ui class name utility.
 * Merges Tailwind classes safely, resolving conflicts via tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
