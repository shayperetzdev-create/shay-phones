import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date))
  } catch (error) {
    return '';
  }
}

export function formatDateTime(date: string | Date) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  } catch (error) {
    return '';
  }
}

export function formatCurrency(amount: number) {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `₪${formattedAmount}`;
}

export function validateIMEI(imei: string): boolean {
  // IMEI should be 15 digits
  if (!/^\d{15}$/.test(imei)) {
    return false;
  }

  // Luhn algorithm validation
  let sum = 0;
  let double = false;

  for (let i = imei.length - 1; i >= 0; i--) {
    let digit = parseInt(imei[i]);

    if (double) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
}

export function validateIsraeliPhone(phone: string): boolean {
  // Remove any non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Israeli phone patterns
  const patterns = [
    /^05\d{8}$/,  // Mobile: 05X-XXXXXXX
    /^0[2-9]\d{7}$/,  // Landline: 0X-XXXXXXX
    /^1700\d{6}$/,  // 1700 numbers
    /^1800\d{6}$/,  // 1800 numbers
  ];
  
  return patterns.some(pattern => pattern.test(cleanPhone));
}

export function generateBatchId(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `BATCH-${year}${month}${day}-${random}`;
}

export function getWarrantyStatus(expiryDate: string | Date): 'active' | 'expired' | 'expiring_soon' {
  const expiry = new Date(expiryDate);
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  if (expiry < today) {
    return 'expired';
  } else if (expiry < thirtyDaysFromNow) {
    return 'expiring_soon';
  } else {
    return 'active';
  }
}

export function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const entry: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      entry[header] = values[index] || '';
    });
    
    data.push(entry);
  }
  
  return data;
}

export function downloadFile(content: string, filename: string, type: string = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}