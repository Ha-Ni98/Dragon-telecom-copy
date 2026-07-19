import { useState } from 'react';
import { clientApiService } from '@/services/client.service.api';
import { Client } from '@/types';

export interface PhoneValidationResult {
  isValid: boolean;
  exists: boolean;
  error?: string;
}

export interface RegistrationResult {
  success: boolean;
  error?: string;
  data?: any;
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
      // First validate format
      if (!clientApiService.validatePhoneNumber(phone)) {
        const error = 'Invalid phone number format. Please use +213 followed by 9 digits or 0 followed by 9 digits.';
        setPhoneError(error);
        return {
          isValid: false,
          exists: false,
          error,
        };
      }

      // Then check if phone exists
      const exists = await clientApiService.checkPhoneExists(phone);
      
      if (exists) {
        const error = 'This phone number is already registered.';
        setPhoneError(error);
        return {
          isValid: true,
          exists: true,
          error,
        };
      }

      return {
        isValid: true,
        exists: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Phone validation failed';
      setPhoneError(errorMessage);
      return {
        isValid: false,
        exists: false,
        error: errorMessage,
      };
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
      // First validate phone
      const phoneValidation = await validatePhone(formData?.clientPhoneNumber || '');
      
      if (!phoneValidation.isValid || phoneValidation.exists) {
        return {
          success: false,
          error: phoneValidation.error || 'Phone validation failed',
        };
      }

      // Create client
      const response = await clientApiService.createClient(formData);
      
      if (response.success) {
        setShowSuccess(true);
        
        // Hide success message after 5 seconds
        setTimeout(() => {
          setShowSuccess(false);
        }, 5000);

        return {
          success: true,
          data: response.data,
        };
      } else {
        return {
          success: false,
          error: response.message || 'Registration failed',
        };
      }
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
