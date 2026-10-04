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
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

export type ToastVariant = 'neutral' | 'success' | 'info' | 'error' | 'offline';

export interface ToastInput {
  variant: ToastVariant;
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
  success: 4000,
  neutral: 4000,
  info: 4500,
  offline: 5000,
  error: 6000,
};

function ToastMessageItem({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

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
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateY]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -12,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  const getVariantStyles = () => {
    switch (toast.variant) {
      case 'success':
        return {
          bg: '#ECFDF5',
          border: '#A7F3D0',
          text: '#065F46',
          icon: <CheckCircle2 size={18} color="#059669" />,
        };
      case 'error':
        return {
          bg: '#FEF2F2',
          border: '#FECACA',
          text: '#991B1B',
          icon: <AlertCircle size={18} color="#DC2626" />,
        };
      case 'offline':
        return {
          bg: '#FFFBEB',
          border: '#FDE68A',
          text: '#92400E',
          icon: <WifiOff size={18} color="#D97706" />,
        };
      case 'info':
      case 'neutral':
      default:
        return {
          bg: '#EEF2FF',
          border: '#C7D2FE',
          text: '#1E1B4B',
          icon: <Info size={18} color="#4F46E5" />,
        };
    }
  };

  const v = getVariantStyles();

  return (
    <Animated.View
      style={[
        styles.toastCard,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.toastLeft}>
        {v.icon}
        <Text style={[styles.toastText, { color: v.text }]} numberOfLines={3}>
          {toast.message}
        </Text>
      </View>

      <View style={styles.toastActions}>
        {toast.action && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionBtnText, { color: v.text }]}>
              {toast.action.label}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={15} color={v.text} />
        </TouchableOpacity>
      </View>
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
      setToasts((prev) => [...prev.slice(-2), { ...input, id }]); // max 3 active

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
        if (typeof descOrAction === 'string') {
          const message = descOrAction ? `${titleOrMessage} • ${descOrAction}` : titleOrMessage;
          show({ variant, message, action });
        } else {
          show({ variant, message: titleOrMessage, action: descOrAction });
        }
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
  },
  toastCard: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  toastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
  },
  toastActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  closeBtn: {
    padding: 3,
    opacity: 0.7,
  },
});
