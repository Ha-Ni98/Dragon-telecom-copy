import { useState } from 'react';
import { validatePhoneNumber, checkPhoneExists, registerClient as registerClientRequest } from '@/services/clients.service';
import { Client } from '@/types/draft-types/client.types';

export interface PhoneValidationResult {
  isValid: boolean;
  exists: boolean;
  error?: string;
}

export interface RegistrationResult {
  success: boolean;
  error?: string;
}

export function useRegistration() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingPhone, setIsValidatingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  /**
   * Validate phone number format and check for duplicates
   */
  const validatePhone = async (phone: string): Promise<PhoneValidationResult> => {
    setIsValidatingPhone(true);
    setPhoneError(null);

    try {
      if (!validatePhoneNumber(phone)) {
        const error = 'Invalid phone number format. Please use +213 followed by 9 digits or 0 followed by 9 digits.';
        setPhoneError(error);
        return { isValid: false, exists: false, error };
      }

      const exists = await checkPhoneExists(phone);

      if (exists) {
        const error = 'This phone number is already registered.';
        setPhoneError(error);
        return { isValid: true, exists: true, error };
      }

      return { isValid: true, exists: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Phone validation failed';
      setPhoneError(errorMessage);
      return { isValid: false, exists: false, error: errorMessage };
    } finally {
      setIsValidatingPhone(false);
    }
  };

  /**
   * Register a new client
   */
  const registerClient = async (formData: Partial<Client>): Promise<RegistrationResult> => {
    setIsSubmitting(true);
    setPhoneError(null);

    try {
      const phoneValidation = await validatePhone(formData?.clientPhoneNumber || '');

      if (!phoneValidation.isValid || phoneValidation.exists) {
        return {
          success: false,
          error: phoneValidation.error || 'Phone validation failed',
        };
      }

      await registerClientRequest(formData);
      setShowSuccess(true);

      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Reset success state
   */
  const resetSuccess = () => {
    setShowSuccess(false);
  };

  /**
   * Clear phone error
   */
  const clearPhoneError = () => {
    setPhoneError(null);
  };

  return {
    // State
    isSubmitting,
    isValidatingPhone,
    phoneError,
    showSuccess,

    // Actions
    validatePhone,
    registerClient,
    resetSuccess,
    clearPhoneError,
  };
}
