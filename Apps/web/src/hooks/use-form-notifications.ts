import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

/**
 * Notification type enumeration
 */
export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  LOADING = 'loading'
}

/**
 * Notification interface
 */
interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
  dismissed: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Notification state interface
 */
interface NotificationState {
  notifications: Notification[];
  activeNotifications: number;
  hasErrors: boolean;
  hasWarnings: boolean;
}

/**
 * Custom hook for form notifications
 */
export function useFormNotifications() {
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    activeNotifications: 0,
    hasErrors: false,
    hasWarnings: false
  });

  /**
   * Show success notification
   */
  const showSuccess = useCallback((
    title: string,
    message: string,
    duration: number = 5000,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = `success_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notification: Notification = {
      id,
      type: NotificationType.SUCCESS,
      title,
      message,
      duration,
      timestamp: new Date(),
      dismissed: false,
      action
    };

    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, notification],
      activeNotifications: prev.activeNotifications + 1
    }));

    toast.success(message, {
      duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick
      } : undefined
    });

    return id;
  }, []);

  /**
   * Show error notification
   */
  const showError = useCallback((
    title: string,
    message: string,
    duration: number = 8000,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notification: Notification = {
      id,
      type: NotificationType.ERROR,
      title,
      message,
      duration,
      timestamp: new Date(),
      dismissed: false,
      action
    };

    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, notification],
      activeNotifications: prev.activeNotifications + 1,
      hasErrors: true
    }));

    toast.error(message, {
      duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick
      } : undefined
    });

    return id;
  }, []);

  /**
   * Show warning notification
   */
  const showWarning = useCallback((
    title: string,
    message: string,
    duration: number = 6000,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = `warning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notification: Notification = {
      id,
      type: NotificationType.WARNING,
      title,
      message,
      duration,
      timestamp: new Date(),
      dismissed: false,
      action
    };

    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, notification],
      activeNotifications: prev.activeNotifications + 1,
      hasWarnings: true
    }));

    toast.warning(message, {
      duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick
      } : undefined
    });

    return id;
  }, []);

  /**
   * Show info notification
   */
  const showInfo = useCallback((
    title: string,
    message: string,
    duration: number = 4000,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = `info_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notification: Notification = {
      id,
      type: NotificationType.INFO,
      title,
      message,
      duration,
      timestamp: new Date(),
      dismissed: false,
      action
    };

    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, notification],
      activeNotifications: prev.activeNotifications + 1
    }));

    toast.info(message, {
      duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick
      } : undefined
    });

    return id;
  }, []);

  /**
   * Show loading notification
   */
  const showLoading = useCallback((
    title: string,
    message: string,
    duration?: number
  ) => {
    const id = `loading_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notification: Notification = {
      id,
      type: NotificationType.LOADING,
      title,
      message,
      duration,
      timestamp: new Date(),
      dismissed: false
    };

    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, notification],
      activeNotifications: prev.activeNotifications + 1
    }));

    toast.loading(message, {
      duration
    });

    return id;
  }, []);

  /**
   * Dismiss notification
   */
  const dismissNotification = useCallback((id: string) => {
    setState(prev => {
      const newNotifications = prev.notifications.map(notification =>
        notification.id === id ? { ...notification, dismissed: true } : notification
      );
      
      const activeNotifications = newNotifications.filter(n => !n.dismissed).length;
      const hasErrors = newNotifications.some(n => n.type === NotificationType.ERROR && !n.dismissed);
      const hasWarnings = newNotifications.some(n => n.type === NotificationType.WARNING && !n.dismissed);

      return {
        notifications: newNotifications,
        activeNotifications,
        hasErrors,
        hasWarnings
      };
    });
  }, []);

  /**
   * Clear all notifications
   */
  const clearAllNotifications = useCallback(() => {
    setState({
      notifications: [],
      activeNotifications: 0,
      hasErrors: false,
      hasWarnings: false
    });
  }, []);

  /**
   * Clear notifications by type
   */
  const clearNotificationsByType = useCallback((type: NotificationType) => {
    setState(prev => {
      const newNotifications = prev.notifications.filter(n => n.type !== type);
      const activeNotifications = newNotifications.filter(n => !n.dismissed).length;
      const hasErrors = newNotifications.some(n => n.type === NotificationType.ERROR && !n.dismissed);
      const hasWarnings = newNotifications.some(n => n.type === NotificationType.WARNING && !n.dismissed);

      return {
        notifications: newNotifications,
        activeNotifications,
        hasErrors,
        hasWarnings
      };
    });
  }, []);

  /**
   * Get notification summary
   */
  const getNotificationSummary = useCallback(() => {
    const activeNotifications = state.notifications.filter(n => !n.dismissed);
    
    return {
      total: activeNotifications.length,
      byType: {
        success: activeNotifications.filter(n => n.type === NotificationType.SUCCESS).length,
        error: activeNotifications.filter(n => n.type === NotificationType.ERROR).length,
        warning: activeNotifications.filter(n => n.type === NotificationType.WARNING).length,
        info: activeNotifications.filter(n => n.type === NotificationType.INFO).length,
        loading: activeNotifications.filter(n => n.type === NotificationType.LOADING).length
      },
      hasErrors: state.hasErrors,
      hasWarnings: state.hasWarnings
    };
  }, [state]);

  /**
   * Get notifications by type
   */
  const getNotificationsByType = useCallback((type: NotificationType) => {
    return state.notifications.filter(n => n.type === type && !n.dismissed);
  }, [state.notifications]);

  /**
   * Auto-dismiss old notifications
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      setState(prev => {
        const newNotifications = prev.notifications.filter(n => 
          n.timestamp > fiveMinutesAgo || n.type === NotificationType.LOADING
        );
        
        if (newNotifications.length !== prev.notifications.length) {
          const activeNotifications = newNotifications.filter(n => !n.dismissed).length;
          const hasErrors = newNotifications.some(n => n.type === NotificationType.ERROR && !n.dismissed);
          const hasWarnings = newNotifications.some(n => n.type === NotificationType.WARNING && !n.dismissed);

          return {
            notifications: newNotifications,
            activeNotifications,
            hasErrors,
            hasWarnings
          };
        }
        
        return prev;
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    dismissNotification,
    clearAllNotifications,
    clearNotificationsByType,
    
    // Utilities
    getNotificationSummary,
    getNotificationsByType
  };
}
