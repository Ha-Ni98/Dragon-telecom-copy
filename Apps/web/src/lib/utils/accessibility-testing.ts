/**
 * Accessibility testing utilities for the Admin Product Add form
 */

export interface AccessibilityTestResult {
  test: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
  element?: HTMLElement;
  fix?: string;
}

export interface AccessibilityTestSuite {
  name: string;
  tests: AccessibilityTestResult[];
  score: number;
  passed: boolean;
}

/**
 * Test ARIA labels on form elements
 */
export function testAriaLabels(): AccessibilityTestResult[] {
  const results: AccessibilityTestResult[] = [];
  
  // Test input labels
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach((input, index) => {
    const element = input as HTMLElement;
    const id = element.getAttribute('id');
    const label = document.querySelector(`label[for="${id}"]`);
    const ariaLabel = element.getAttribute('aria-label');
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    
    if (!label && !ariaLabel && !ariaLabelledBy) {
      results.push({
        test: 'aria-labels',
        passed: false,
        message: `Input element ${index + 1} is missing an accessible name`,
        severity: 'error',
        element,
        fix: 'Add a label element, aria-label, or aria-labelledby attribute'
      });
    } else {
      results.push({
        test: 'aria-labels',
        passed: true,
        message: `Input element ${index + 1} has proper accessible name`,
        severity: 'info',
        element
      });
    }
  });

  // Test button labels
  const buttons = document.querySelectorAll('button');
  buttons.forEach((button, index) => {
    const element = button as HTMLElement;
    const text = element.textContent?.trim();
    const ariaLabel = element.getAttribute('aria-label');
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    
    if (!text && !ariaLabel && !ariaLabelledBy) {
      results.push({
        test: 'button-labels',
        passed: false,
        message: `Button ${index + 1} is missing an accessible name`,
        severity: 'error',
        element,
        fix: 'Add text content or aria-label attribute'
      });
    } else {
      results.push({
        test: 'button-labels',
        passed: true,
        message: `Button ${index + 1} has proper accessible name`,
        severity: 'info',
        element
      });
    }
  });

  return results;
}

/**
 * Test keyboard navigation
 */
export function testKeyboardNavigation(): AccessibilityTestResult[] {
  const results: AccessibilityTestResult[] = [];
  
  // Test tab order
  const focusableElements = document.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) {
    results.push({
      test: 'keyboard-navigation',
      passed: false,
      message: 'No focusable elements found',
      severity: 'error',
      fix: 'Add keyboard-accessible elements to the form'
    });
  } else {
    results.push({
      test: 'keyboard-navigation',
      passed: true,
      message: `${focusableElements.length} focusable elements found`,
      severity: 'info'
    });
  }

  // Test tabindex values
  const elementsWithTabindex = document.querySelectorAll('[tabindex]');
  elementsWithTabindex.forEach((element, index) => {
    const tabindex = element.getAttribute('tabindex');
    if (tabindex && parseInt(tabindex) > 0) {
      results.push({
        test: 'tabindex-values',
        passed: false,
        message: `Element ${index + 1} has positive tabindex value (${tabindex})`,
        severity: 'warning',
        element: element as HTMLElement,
        fix: 'Avoid positive tabindex values as they can disrupt natural tab order'
      });
    }
  });

  return results;
}

/**
 * Test color contrast
 */
export function testColorContrast(): AccessibilityTestResult[] {
  const results: AccessibilityTestResult[] = [];
  
  // This is a simplified test - in a real implementation, you'd use a library like axe-core
  const elements = document.querySelectorAll('*');
  let contrastIssues = 0;
  
  elements.forEach((element) => {
    const styles = window.getComputedStyle(element);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;
    
    if (color && backgroundColor && color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
      // Simplified contrast check - in reality, you'd calculate actual contrast ratio
      if (color === backgroundColor) {
        contrastIssues++;
        results.push({
          test: 'color-contrast',
          passed: false,
          message: 'Text and background colors are identical',
          severity: 'error',
          element: element as HTMLElement,
          fix: 'Ensure sufficient color contrast between text and background'
        });
      }
    }
  });

  if (contrastIssues === 0) {
    results.push({
      test: 'color-contrast',
      passed: true,
      message: 'No obvious color contrast issues found',
      severity: 'info'
    });
  }

  return results;
}

/**
 * Test form structure
 */
export function testFormStructure(): AccessibilityTestResult[] {
  const results: AccessibilityTestResult[] = [];
  
  // Test for form element
  const form = document.querySelector('form');
  if (!form) {
    results.push({
      test: 'form-structure',
      passed: false,
      message: 'No form element found',
      severity: 'error',
      fix: 'Wrap form inputs in a form element'
    });
  } else {
    results.push({
      test: 'form-structure',
      passed: true,
      message: 'Form element found',
      severity: 'info'
    });
  }

  // Test for fieldset elements
  const fieldsets = document.querySelectorAll('fieldset');
  if (fieldsets.length === 0) {
    results.push({
      test: 'form-structure',
      passed: false,
      message: 'No fieldset elements found for grouping related fields',
      severity: 'warning',
      fix: 'Consider using fieldset elements to group related form fields'
    });
  } else {
    results.push({
      test: 'form-structure',
      passed: true,
      message: `${fieldsets.length} fieldset elements found`,
      severity: 'info'
    });
  }

  // Test for legend elements
  const fieldsetsWithLegends = document.querySelectorAll('fieldset legend');
  if (fieldsets.length > 0 && fieldsetsWithLegends.length === 0) {
    results.push({
      test: 'form-structure',
      passed: false,
      message: 'Fieldset elements missing legend elements',
      severity: 'error',
      fix: 'Add legend elements to describe fieldset groups'
    });
  } else if (fieldsetsWithLegends.length > 0) {
    results.push({
      test: 'form-structure',
      passed: true,
      message: `${fieldsetsWithLegends.length} legend elements found`,
      severity: 'info'
    });
  }

  return results;
}

/**
 * Test error handling
 */
export function testErrorHandling(): AccessibilityTestResult[] {
  const results: AccessibilityTestResult[] = [];
  
  // Test for error messages
  const errorElements = document.querySelectorAll('[aria-invalid="true"]');
  errorElements.forEach((element, index) => {
    const ariaDescribedBy = element.getAttribute('aria-describedby');
    const errorMessage = document.querySelector(`#${ariaDescribedBy}`);
    
    if (!errorMessage) {
      results.push({
        test: 'error-handling',
        passed: false,
        message: `Invalid element ${index + 1} missing error message`,
        severity: 'error',
        element: element as HTMLElement,
        fix: 'Add error message with aria-describedby'
      });
    } else {
      results.push({
        test: 'error-handling',
        passed: true,
        message: `Invalid element ${index + 1} has error message`,
        severity: 'info',
        element: element as HTMLElement
      });
    }
  });

  return results;
}

/**
 * Test screen reader support
 */
export function testScreenReaderSupport(): AccessibilityTestResult[] {
  const results: AccessibilityTestResult[] = [];
  
  // Test for live regions
  const liveRegions = document.querySelectorAll('[aria-live]');
  if (liveRegions.length === 0) {
    results.push({
      test: 'screen-reader-support',
      passed: false,
      message: 'No live regions found for dynamic content',
      severity: 'warning',
      fix: 'Add aria-live regions for dynamic content updates'
    });
  } else {
    results.push({
      test: 'screen-reader-support',
      passed: true,
      message: `${liveRegions.length} live regions found`,
      severity: 'info'
    });
  }

  // Test for aria-describedby
  const elementsWithDescribedBy = document.querySelectorAll('[aria-describedby]');
  elementsWithDescribedBy.forEach((element, index) => {
    const describedBy = element.getAttribute('aria-describedby');
    const describedElement = document.querySelector(`#${describedBy}`);
    
    if (!describedElement) {
      results.push({
        test: 'screen-reader-support',
        passed: false,
        message: `Element ${index + 1} references non-existent described element`,
        severity: 'error',
        element: element as HTMLElement,
        fix: 'Ensure aria-describedby references existing elements'
      });
    } else {
      results.push({
        test: 'screen-reader-support',
        passed: true,
        message: `Element ${index + 1} has valid described element`,
        severity: 'info',
        element: element as HTMLElement
      });
    }
  });

  return results;
}

/**
 * Run complete accessibility test suite
 */
export function runAccessibilityTestSuite(): AccessibilityTestSuite {
  const tests = [
    ...testAriaLabels(),
    ...testKeyboardNavigation(),
    ...testColorContrast(),
    ...testFormStructure(),
    ...testErrorHandling(),
    ...testScreenReaderSupport()
  ];

  const passedTests = tests.filter(test => test.passed).length;
  const totalTests = tests.length;
  const score = Math.round((passedTests / totalTests) * 100);

  return {
    name: 'Admin Product Add Form Accessibility Test Suite',
    tests,
    score,
    passed: score >= 80
  };
}

/**
 * Test specific form field
 */
export function testFormField(fieldName: string): AccessibilityTestResult[] {
  const results: AccessibilityTestResult[] = [];
  
  const field = document.querySelector(`[name="${fieldName}"]`) as HTMLElement;
  if (!field) {
    results.push({
      test: 'form-field',
      passed: false,
      message: `Field ${fieldName} not found`,
      severity: 'error',
      fix: 'Ensure field exists and has correct name attribute'
    });
    return results;
  }

  // Test field has label
  const id = field.getAttribute('id');
  const label = document.querySelector(`label[for="${id}"]`);
  const ariaLabel = field.getAttribute('aria-label');
  const ariaLabelledBy = field.getAttribute('aria-labelledby');
  
  if (!label && !ariaLabel && !ariaLabelledBy) {
    results.push({
      test: 'form-field',
      passed: false,
      message: `Field ${fieldName} missing accessible name`,
      severity: 'error',
      element: field,
      fix: 'Add label, aria-label, or aria-labelledby'
    });
  } else {
    results.push({
      test: 'form-field',
      passed: true,
      message: `Field ${fieldName} has accessible name`,
      severity: 'info',
      element: field
    });
  }

  // Test field has description if needed
  const ariaDescribedBy = field.getAttribute('aria-describedby');
  if (ariaDescribedBy) {
    const describedElement = document.querySelector(`#${ariaDescribedBy}`);
    if (!describedElement) {
      results.push({
        test: 'form-field',
        passed: false,
        message: `Field ${fieldName} references non-existent described element`,
        severity: 'error',
        element: field,
        fix: 'Ensure aria-describedby references existing elements'
      });
    } else {
      results.push({
        test: 'form-field',
        passed: true,
        message: `Field ${fieldName} has valid described element`,
        severity: 'info',
        element: field
      });
    }
  }

  return results;
}

/**
 * Test form submission accessibility
 */
export function testFormSubmissionAccessibility(): AccessibilityTestResult[] {
  const results: AccessibilityTestResult[] = [];
  
  // Test submit button
  const submitButton = document.querySelector('button[type="submit"]') as HTMLElement;
  if (!submitButton) {
    results.push({
      test: 'form-submission',
      passed: false,
      message: 'No submit button found',
      severity: 'error',
      fix: 'Add submit button to form'
    });
  } else {
    results.push({
      test: 'form-submission',
      passed: true,
      message: 'Submit button found',
      severity: 'info',
      element: submitButton
    });
  }

  // Test form validation
  const invalidFields = document.querySelectorAll('[aria-invalid="true"]');
  if (invalidFields.length > 0) {
    results.push({
      test: 'form-submission',
      passed: false,
      message: `${invalidFields.length} invalid fields found`,
      severity: 'warning',
      fix: 'Fix validation errors before submission'
    });
  } else {
    results.push({
      test: 'form-submission',
      passed: true,
      message: 'No validation errors found',
      severity: 'info'
    });
  }

  return results;
}
