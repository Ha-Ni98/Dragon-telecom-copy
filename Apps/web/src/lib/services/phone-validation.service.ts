import { mockExistingPhones } from "@/mocks/clients";

/**
 * Phone validation service for registration form
 * Handles Algerian phone number format validation and duplicate checking
 */
export class PhoneValidationService {
  /**
   * Validates if a phone number matches Algerian format
   * Algerian phone numbers: +213 followed by 9 digits OR 0 followed by 9 digits
   * Examples: +213 555 555 555, +213555555555, 0555555555
   * 
   * @param phone - Phone number to validate
   * @returns boolean - true if valid Algerian format
   */
  static validatePhoneNumber(phone: string): boolean {
    if (!phone || typeof phone !== 'string') {
      return false;
    }

    // Remove all spaces and normalize the phone number
    const normalizedPhone = phone.replace(/\s+/g, '');
    
    // Algerian phone number regex: +213 followed by exactly 9 digits OR 0 followed by exactly 9 digits
    const algerianPhoneRegex = /^(\+213[0-9]{9}|0[0-9]{9})$/;
    
    return algerianPhoneRegex.test(normalizedPhone);
  }

  /**
   * Checks if a phone number already exists in the system
   * 
   * @param phone - Phone number to check
   * @returns Promise<boolean> - true if phone exists, false if available
   */
  static async checkPhoneExists(phone: string): Promise<boolean> {
    if (!phone || typeof phone !== 'string') {
      return false;
    }

    try {
      // Normalize the input phone number
      const normalizedInputPhone = phone.replace(/\s+/g, '');
      
      // Check against existing phones in mock data
      const exists = mockExistingPhones.some(existingPhone => {
        const normalizedExistingPhone = existingPhone.replace(/\s+/g, '');
        return normalizedInputPhone === normalizedExistingPhone;
      });

      return exists;
    } catch (error) {
      console.error('Error checking phone existence:', error);
      // In case of error, assume phone doesn't exist to allow registration
      return false;
    }
  }

  /**
   * Validates phone number format and checks for duplicates
   * Combined validation method for form submission
   * 
   * @param phone - Phone number to validate
   * @returns Promise<{isValid: boolean, exists: boolean, error?: string}>
   */
  static async validatePhoneForRegistration(phone: string): Promise<{
    isValid: boolean;
    exists: boolean;
    error?: string;
  }> {
    // First check format
    if (!this.validatePhoneNumber(phone)) {
      return {
        isValid: false,
        exists: false,
        error: 'Invalid phone number format. Please use +213 followed by 9 digits.'
      };
    }

    // Then check if exists
    const exists = await this.checkPhoneExists(phone);
    
    if (exists) {
      return {
        isValid: true,
        exists: true,
        error: 'This phone number already exists.'
      };
    }

    return {
      isValid: true,
      exists: false
    };
  }

  /**
   * Formats a phone number to standard display format
   * Converts +213XXXXXXXXX to +213 XXX XXX XXX
   * Converts 0XXXXXXXXX to 0XXX XXX XXX
   * 
   * @param phone - Phone number to format
   * @returns string - Formatted phone number
   */
  static formatPhoneNumber(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      return '';
    }

    const normalizedPhone = phone.replace(/\s+/g, '');
    
    // If it's a valid Algerian phone number, format it
    if (this.validatePhoneNumber(normalizedPhone)) {
      if (normalizedPhone.startsWith('+213')) {
        const digits = normalizedPhone.substring(4); // Remove +213
        return `+213 ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6, 9)}`;
      } else if (normalizedPhone.startsWith('0')) {
        const digits = normalizedPhone.substring(1); // Remove 0
        return `0${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6, 9)}`;
      }
    }

    return phone; // Return original if not valid format
  }
}

// Export default instance for convenience
export default PhoneValidationService;
