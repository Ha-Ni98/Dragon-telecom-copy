/**
 * Comprehensive logging utilities for the Admin Product Add form
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  enableRemote: boolean;
  maxEntries: number;
  storageKey: string;
  remoteEndpoint?: string;
}

class Logger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private sessionId: string;
  private userId?: string;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    this.loadStoredLogs();
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadStoredLogs(): void {
    if (this.config.enableStorage) {
      try {
        const stored = localStorage.getItem(this.config.storageKey);
        if (stored) {
          this.logs = JSON.parse(stored);
        }
      } catch (error) {
        console.warn('Failed to load stored logs:', error);
      }
    }
  }

  private saveLogs(): void {
    if (this.config.enableStorage) {
      try {
        localStorage.setItem(this.config.storageKey, JSON.stringify(this.logs));
      } catch (error) {
        console.warn('Failed to save logs:', error);
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
    component?: string,
    action?: string,
    duration?: number,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      userId: this.userId,
      sessionId: this.sessionId,
      component,
      action,
      duration,
      metadata
    };
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    this.logs.push(entry);

    // Limit log entries
    if (this.logs.length > this.config.maxEntries) {
      this.logs = this.logs.slice(-this.config.maxEntries);
    }

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Storage logging
    if (this.config.enableStorage) {
      this.saveLogs();
    }

    // Remote logging
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.logToRemote(entry);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const { level, message, context, error } = entry;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();

    const logMessage = `[${timestamp}] [${LogLevel[level]}] ${message}`;
    const logData = { context, error, sessionId: entry.sessionId };

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, logData);
        break;
      case LogLevel.INFO:
        console.info(logMessage, logData);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, logData);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, logData);
        break;
      case LogLevel.FATAL:
        console.error(`🚨 FATAL: ${logMessage}`, logData);
        break;
    }
  }

  private async logToRemote(entry: LogEntry): Promise<void> {
    try {
      await fetch(this.config.remoteEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.warn('Failed to send log to remote endpoint:', error);
    }
  }

  // Public logging methods
  debug(message: string, context?: Record<string, any>, component?: string): void {
    this.log(this.createLogEntry(LogLevel.DEBUG, message, context, undefined, component));
  }

  info(message: string, context?: Record<string, any>, component?: string): void {
    this.log(this.createLogEntry(LogLevel.INFO, message, context, undefined, component));
  }

  warn(message: string, context?: Record<string, any>, component?: string): void {
    this.log(this.createLogEntry(LogLevel.WARN, message, context, undefined, component));
  }

  error(message: string, error?: Error, context?: Record<string, any>, component?: string): void {
    this.log(this.createLogEntry(LogLevel.ERROR, message, context, error, component));
  }

  fatal(message: string, error?: Error, context?: Record<string, any>, component?: string): void {
    this.log(this.createLogEntry(LogLevel.FATAL, message, context, error, component));
  }

  // Action logging
  logAction(action: string, component: string, context?: Record<string, any>, duration?: number): void {
    this.log(this.createLogEntry(
      LogLevel.INFO,
      `Action: ${action}`,
      context,
      undefined,
      component,
      action,
      duration
    ));
  }

  // Performance logging
  logPerformance(operation: string, duration: number, context?: Record<string, any>): void {
    this.log(this.createLogEntry(
      LogLevel.INFO,
      `Performance: ${operation} took ${duration}ms`,
      context,
      undefined,
      'Performance',
      operation,
      duration
    ));
  }

  // Form logging
  logFormEvent(event: string, formData: any, context?: Record<string, any>): void {
    this.log(this.createLogEntry(
      LogLevel.INFO,
      `Form Event: ${event}`,
      { ...context, formData },
      undefined,
      'Form',
      event
    ));
  }

  // Error logging
  logError(error: Error, context?: Record<string, any>, component?: string): void {
    this.log(this.createLogEntry(
      LogLevel.ERROR,
      error.message,
      context,
      error,
      component
    ));
  }

  // User interaction logging
  logUserInteraction(interaction: string, context?: Record<string, any>): void {
    this.log(this.createLogEntry(
      LogLevel.INFO,
      `User Interaction: ${interaction}`,
      context,
      undefined,
      'UserInteraction',
      interaction
    ));
  }

  // API logging
  logApiCall(method: string, url: string, status: number, duration: number, context?: Record<string, any>): void {
    this.log(this.createLogEntry(
      LogLevel.INFO,
      `API Call: ${method} ${url} - ${status}`,
      { ...context, method, url, status },
      undefined,
      'API',
      'apiCall',
      duration
    ));
  }

  // Get logs
  getLogs(level?: LogLevel, component?: string): LogEntry[] {
    let filteredLogs = this.logs;

    if (level !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.level >= level);
    }

    if (component) {
      filteredLogs = filteredLogs.filter(log => log.component === component);
    }

    return filteredLogs;
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
    if (this.config.enableStorage) {
      localStorage.removeItem(this.config.storageKey);
    }
  }

  // Export logs
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Set user ID
  setUserId(userId: string): void {
    this.userId = userId;
  }

  // Get session ID
  getSessionId(): string {
    return this.sessionId;
  }

  // Update config
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Default logger instance
const defaultLogger = new Logger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableStorage: true,
  enableRemote: false,
  maxEntries: 1000,
  storageKey: 'admin-product-add-logs'
});

// Export logger instance and utilities
export const logger = defaultLogger;

// Form-specific logging utilities
export const formLogger = {
  logFormStart: (formData: any) => {
    logger.logFormEvent('Form Started', formData);
  },

  logFormFieldChange: (field: string, value: any, formData: any) => {
    logger.logFormEvent('Field Changed', formData, { field, value });
  },

  logFormValidation: (isValid: boolean, errors: any[], formData: any) => {
    logger.logFormEvent('Form Validated', formData, { isValid, errors });
  },

  logFormSubmission: (formData: any, success: boolean, error?: Error) => {
    logger.logFormEvent('Form Submitted', formData, { success, error: error?.message });
  },

  logFormReset: (formData: any) => {
    logger.logFormEvent('Form Reset', formData);
  },

  logFormSave: (formData: any, success: boolean, error?: Error) => {
    logger.logFormEvent('Form Saved', formData, { success, error: error?.message });
  }
};

// Performance logging utilities
export const performanceLogger = {
  logRenderTime: (component: string, duration: number) => {
    logger.logPerformance(`Render ${component}`, duration);
  },

  logApiCall: (method: string, url: string, status: number, duration: number) => {
    logger.logApiCall(method, url, status, duration);
  },

  logImageUpload: (filename: string, size: number, duration: number) => {
    logger.logPerformance(`Image Upload ${filename}`, duration, { size });
  },

  logFormValidation: (duration: number, fieldCount: number) => {
    logger.logPerformance('Form Validation', duration, { fieldCount });
  }
};

// Error logging utilities
export const errorLogger = {
  logFormError: (error: Error, formData: any, context?: Record<string, any>) => {
    logger.logError(error, { ...context, formData }, 'Form');
  },

  logValidationError: (field: string, error: string, formData: any) => {
    logger.error(`Validation Error: ${field} - ${error}`, undefined, { field, formData }, 'Validation');
  },

  logSubmissionError: (error: Error, formData: any) => {
    logger.error('Form Submission Error', error, { formData }, 'FormSubmission');
  },

  logImageUploadError: (error: Error, filename: string, formData: any) => {
    logger.error('Image Upload Error', error, { filename, formData }, 'ImageUpload');
  }
};

// User interaction logging utilities
export const userLogger = {
  logButtonClick: (button: string, context?: Record<string, any>) => {
    logger.logUserInteraction(`Button Click: ${button}`, context);
  },

  logFieldFocus: (field: string, context?: Record<string, any>) => {
    logger.logUserInteraction(`Field Focus: ${field}`, context);
  },

  logFieldBlur: (field: string, value: any, context?: Record<string, any>) => {
    logger.logUserInteraction(`Field Blur: ${field}`, { ...context, value });
  },

  logKeyboardNavigation: (key: string, context?: Record<string, any>) => {
    logger.logUserInteraction(`Keyboard Navigation: ${key}`, context);
  },

  logImageUpload: (filename: string, size: number, context?: Record<string, any>) => {
    logger.logUserInteraction(`Image Upload: ${filename}`, { ...context, size });
  },

  logImageDelete: (filename: string, context?: Record<string, any>) => {
    logger.logUserInteraction(`Image Delete: ${filename}`, context);
  }
};

// Debug logging utilities
export const debugLogger = {
  logComponentMount: (component: string, props?: any) => {
    logger.debug(`Component Mounted: ${component}`, { props }, component);
  },

  logComponentUnmount: (component: string) => {
    logger.debug(`Component Unmounted: ${component}`, undefined, component);
  },

  logStateChange: (component: string, state: any, prevState?: any) => {
    logger.debug(`State Changed: ${component}`, { state, prevState }, component);
  },

  logHookCall: (hook: string, params?: any, result?: any) => {
    logger.debug(`Hook Called: ${hook}`, { params, result }, hook);
  }
};

// Export all logging utilities (LogEntry/LoggerConfig are already exported inline above)
export { Logger };
