/**
 * Date formatting utilities for consistent date display across the application
 */
import type { DateRange } from "@/types/draft-types/admin-statistics.types";

/**
 * Build a DateRange (start/end/label) for one of the admin statistics period presets.
 */
export function generateDateRangeData(type: DateRange['type']): DateRange {
  const now = new Date();
  let startDate: Date;
  let label: string;

  switch (type) {
    case 'weekly':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      label = 'Last 7 Days';
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      label = 'This Month';
      break;
    case 'yearly':
      startDate = new Date(now.getFullYear(), 0, 1);
      label = 'This Year';
      break;
    case 'custom':
    default:
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      label = 'Last 30 Days';
      break;
  }

  return {
    type,
    startDate,
    endDate: now,
    label,
  };
}

/**
 * Format date for display in admin tables and components
 */
export function formatAdminDate(dateString: string, lang: 'en' | 'fr' = 'en'): string {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original string if invalid
    }
    
    if (lang === 'fr') {
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.warn('Date formatting error:', error);
    return dateString; // Return original string on error
  }
}

/**
 * Format date with time for detailed views
 */
export function formatAdminDateTime(dateString: string, lang: 'en' | 'fr' = 'en'): string {
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    if (lang === 'fr') {
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    console.warn('Date time formatting error:', error);
    return dateString;
  }
}

/**
 * Format relative date (e.g., "2 days ago", "1 week ago")
 */
export function formatRelativeDate(dateString: string, lang: 'en' | 'fr' = 'en'): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInWeeks = Math.floor(diffInDays / 7);
    const diffInMonths = Math.floor(diffInDays / 30);
    
    if (lang === 'fr') {
      if (diffInDays === 0) return "Aujourd'hui";
      if (diffInDays === 1) return "Hier";
      if (diffInDays < 7) return `Il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
      if (diffInWeeks === 1) return "Il y a 1 semaine";
      if (diffInWeeks < 4) return `Il y a ${diffInWeeks} semaines`;
      if (diffInMonths === 1) return "Il y a 1 mois";
      return `Il y a ${diffInMonths} mois`;
    }
    
    // English
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    if (diffInWeeks === 1) return "1 week ago";
    if (diffInWeeks < 4) return `${diffInWeeks} weeks ago`;
    if (diffInMonths === 1) return "1 month ago";
    return `${diffInMonths} months ago`;
  } catch (error) {
    console.warn('Relative date formatting error:', error);
    return dateString;
  }
}

/**
 * Get date range for filtering (e.g., "Last 7 days", "This month")
 */
export function getDateRangeOptions(lang: 'en' | 'fr' = 'en') {
  if (lang === 'fr') {
    return [
      { value: 'today', label: "Aujourd'hui" },
      { value: 'yesterday', label: 'Hier' },
      { value: 'last7days', label: '7 derniers jours' },
      { value: 'last30days', label: '30 derniers jours' },
      { value: 'thismonth', label: 'Ce mois' },
      { value: 'lastmonth', label: 'Mois dernier' },
      { value: 'thisyear', label: 'Cette année' },
    ];
  }
  
  return [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 days' },
    { value: 'last30days', label: 'Last 30 days' },
    { value: 'thismonth', label: 'This month' },
    { value: 'lastmonth', label: 'Last month' },
    { value: 'thisyear', label: 'This year' },
  ];
}

/**
 * Validate if a date string is valid
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Get date range for a given period
 */
export function getDateRange(period: string): { start: Date; end: Date } | null {
  const now = new Date();
  const start = new Date();
  const end = new Date();
  
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last7days':
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last30days':
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thismonth':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'lastmonth':
      start.setMonth(now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisyear':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      return null;
  }
  
  return { start, end };
}
