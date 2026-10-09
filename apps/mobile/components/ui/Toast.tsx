import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  WifiOff,
  X,
} from 'lucide-react-native';

export type ToastVariant = 'neutral' | 'success' | 'info' | 'error' | 'offline';

export interface ToastInput {
  variant: ToastVariant;
  title?: string;
  description?: string;
  message: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

export type ToastAction = { label: string; onClick: () => void };

export type ToastFn = (
  titleOrMessage: string,
  descOrAction?: string | ToastAction,
  action?: ToastAction
) => void;

interface ToastContextValue {
  show: (t: ToastInput) => void;
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
  offline: ToastFn;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}

const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 3200,
  neutral: 3200,
  info: 3600,
  offline: 4000,
  error: 4200,
};

/**
 * Strips technical stack traces, error codes, and database/server jargon,
 * transforming them into clear, friendly guidance for non-technical users.
 */
function humanizeNotification(
  rawTitle: string,
  rawDesc?: string
): { title: string; description?: string } {
  let title = (rawTitle || '').trim();
  let desc = (rawDesc || '').trim();

  // If there's an embedded separator like ' • ' or ': '
  if (!desc && title.includes(' • ')) {
    const parts = title.split(' • ');
    title = parts[0].trim();
    desc = parts.slice(1).join(' • ').trim();
  }

  const combined = `${title} ${desc}`.toLowerCase();

  // 1. Network / Server Connection errors
  if (
    combined.includes('econnrefused') ||
    combined.includes('network request failed') ||
    combined.includes('failed to fetch') ||
    combined.includes('could not reach server') ||
    combined.includes('backend server connection') ||
    combined.includes('check connection to server') ||
    combined.includes('check your connection') ||
    combined.includes('check your server connection') ||
    combined.includes('network connection error') ||
    combined.includes('connection error') ||
    combined.includes('network error') ||
    combined.includes('enotfound') ||
    combined.includes('socket hang up') ||
    combined.includes('timed out')
  ) {
    title = 'Connection Issue';
    desc = 'Please check your internet connection and try again.';
  }
  // 2. Database / Internal server errors / Prisma
  else if (
    combined.includes('prisma') ||
    combined.includes('database') ||
    combined.includes('sql') ||
    combined.includes('syntaxerror') ||
    combined.includes('null pointer') ||
    combined.includes('internal server error') ||
    combined.includes('status code 500') ||
    combined.includes('status 500') ||
    combined.includes('500 internal') ||
    combined.includes('query failed')
  ) {
    title = 'Something Went Wrong';
    desc = 'We hit a temporary snag. Please try again in a moment.';
  }
  // 3. Authentication / Session expiration
  else if (
    combined.includes('unauthorized') ||
    combined.includes('jwt') ||
    combined.includes('token expired') ||
    combined.includes('session expired') ||
    combined.includes('invalid credentials')
  ) {
    if (combined.includes('invalid credentials')) {
      title = 'Sign In Failed';
      desc = 'Please check your email and password and try again.';
    } else {
      title = 'Session Expired';
      desc = 'Please sign in again to continue.';
    }
  }
  // 4. Permissions
  else if (
    combined.includes('forbidden') ||
    combined.includes('403') ||
    combined.includes('not permitted')
  ) {
    title = 'Access Restricted';
    desc = "You don't have permission to perform this action.";
  }
  // 5. Password / security technical jargon
  else if (
    combined.includes('encryption keys') ||
    combined.includes('aes') ||
    combined.includes('crypto')
  ) {
    title = 'Password Updated';
    desc = 'Your password has been securely changed.';
  }
  // 6. Trial registration or role technical jargon
  else if (
    combined.includes('role: admin') ||
    combined.includes('opening admin dashboard')
  ) {
    title = 'Workspace Ready';
    desc = 'Opening your dashboard now...';
  }

  // Remove redundant description if it repeats title
  if (desc && desc.toLowerCase() === title.toLowerCase()) {
    desc = '';
  }

  // Remove leading title from description if formatted as "Title: description"
  if (desc && desc.toLowerCase().startsWith(title.toLowerCase() + ':')) {
    desc = desc.substring(title.length + 1).trim();
  }

  // Clean and cap description length for sleek UI
  if (desc.length > 85) {
    desc = desc.substring(0, 82) + '...';
  }

  return { title, description: desc || undefined };
}

function ToastMessageItem({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-24)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateY, scaleAnim]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -16,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  const getVariantConfig = () => {
    switch (toast.variant) {
      case 'success':
        return {
          iconBg: 'rgba(16, 185, 129, 0.16)',
          iconColor: '#10B981',
          accentBorder: 'rgba(16, 185, 129, 0.35)',
          icon: <CheckCircle2 size={16} color="#10B981" strokeWidth={2.5} />,
        };
      case 'error':
        return {
          iconBg: 'rgba(244, 63, 94, 0.16)',
          iconColor: '#F43F5E',
          accentBorder: 'rgba(244, 63, 94, 0.35)',
          icon: <AlertCircle size={16} color="#F43F5E" strokeWidth={2.5} />,
        };
      case 'offline':
        return {
          iconBg: 'rgba(245, 158, 11, 0.16)',
          iconColor: '#F59E0B',
          accentBorder: 'rgba(245, 158, 11, 0.35)',
          icon: <WifiOff size={16} color="#F59E0B" strokeWidth={2.5} />,
        };
      case 'info':
      case 'neutral':
      default:
        return {
          iconBg: 'rgba(99, 102, 241, 0.16)',
          iconColor: '#818CF8',
          accentBorder: 'rgba(99, 102, 241, 0.35)',
          icon: <Info size={16} color="#818CF8" strokeWidth={2.5} />,
        };
    }
  };

  const cfg = getVariantConfig();
  const displayTitle = toast.title || toast.message;
  const displayDesc = toast.description;

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY }, { scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.94}
        onPress={handleDismiss}
        style={[styles.toastCard, { borderColor: cfg.accentBorder }]}
      >
        {/* Leading Accent Icon */}
        <View style={[styles.iconBadge, { backgroundColor: cfg.iconBg }]}>
          {cfg.icon}
        </View>

        {/* Content */}
        <View style={styles.textContainer}>
          <Text style={styles.titleText} numberOfLines={2}>
            {displayTitle}
          </Text>
          {displayDesc ? (
            <Text style={styles.descText} numberOfLines={2}>
              {displayDesc}
            </Text>
          ) : null}
        </View>

        {/* Action Button (optional) */}
        {toast.action && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnText}>{toast.action.label}</Text>
          </TouchableOpacity>
        )}

        {/* Dismiss Button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={14} color="#64748B" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-1), { ...input, id }]); // maximum 2 active for minimal clutter

      const duration = input.duration ?? DEFAULT_DURATIONS[input.variant];
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => {
            dismiss(id);
          }, duration)
        );
      }
    },
    [dismiss]
  );

  const makeToastFn = useCallback(
    (variant: ToastVariant): ToastFn =>
      (titleOrMessage: string, descOrAction?: string | ToastAction, action?: ToastAction) => {
        let actionObj: ToastAction | undefined;
        let rawDesc: string | undefined;

        if (typeof descOrAction === 'string') {
          rawDesc = descOrAction;
          actionObj = action;
        } else if (descOrAction && typeof descOrAction === 'object') {
          actionObj = descOrAction;
        }

        const { title, description } = humanizeNotification(titleOrMessage, rawDesc);
        show({
          variant,
          title,
          description,
          message: description ? `${title}: ${description}` : title,
          action: actionObj,
        });
      },
    [show]
  );

  const success = useMemo(() => makeToastFn('success'), [makeToastFn]);
  const error = useMemo(() => makeToastFn('error'), [makeToastFn]);
  const info = useMemo(() => makeToastFn('info'), [makeToastFn]);
  const offline = useMemo(() => makeToastFn('offline'), [makeToastFn]);

  const value = useMemo(
    () => ({ show, success, error, info, offline }),
    [show, success, error, info, offline]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={[
          styles.container,
          {
            top: Math.max(insets.top + 8, 16),
          },
        ]}
      >
        {toasts.map((toast) => (
          <ToastMessageItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  toastWrapper: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  toastCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0F19', // Sleek obsidian midnight
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    paddingRight: 6,
    justifyContent: 'center',
  },
  titleText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.15,
    lineHeight: 18,
  },
  descText: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '400',
    lineHeight: 15,
    marginTop: 2,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
    opacity: 0.8,
  },
});
