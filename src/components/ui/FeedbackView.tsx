import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import {
  FEEDBACK_GOOGLE_FORM_CONFIG,
  isFeedbackFormConfigured,
} from '../../config/feedbackFormConfig';
import { buildAutoDiagnosticsSnapshot } from '../../utils/runtimeErrorBuffer';

const PENDING_QUEUE_STORAGE_KEY = 'aoa_pending_feedback_v1';

interface QueuedFeedbackPayload {
  id: string;
  message: string;
  diagnostics: string;
  createdAt: string;
}

type SubmitStatus = 'idle' | 'submitting' | 'sent' | 'queued' | 'error';

function readPendingQueue(): QueuedFeedbackPayload[] {
  try {
    const raw = window.localStorage.getItem(PENDING_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingQueue(items: QueuedFeedbackPayload[]): void {
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(PENDING_QUEUE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        PENDING_QUEUE_STORAGE_KEY,
        JSON.stringify(items)
      );
    }
  } catch {
    // Ignore storage quota errors
  }
}

async function postToGoogleForm(payload: QueuedFeedbackPayload): Promise<void> {
  const { formResponseUrl, messageEntryId, diagnosticsEntryId } =
    FEEDBACK_GOOGLE_FORM_CONFIG;

  const body = new URLSearchParams();
  if (diagnosticsEntryId.trim()) {
    body.set(messageEntryId.trim(), payload.message);
    body.set(
      diagnosticsEntryId.trim(),
      `Submitted: ${payload.createdAt}\n${payload.diagnostics}`
    );
  } else {
    body.set(
      messageEntryId.trim(),
      `${payload.message}\n\n---\n[${payload.createdAt}]\n${payload.diagnostics}`
    );
  }

  await fetch(formResponseUrl.trim(), {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: body.toString(),
  });
}

/**
 * Minimalist dark Feedback & Problems tab:
 * bilingual question header + single textarea + Send button,
 * with automatic silent diagnostics and offline queue forwarding to Google Forms.
 */
export const FeedbackView: React.FC = () => {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');

  const flushPendingQueue = useCallback(async () => {
    if (!isFeedbackFormConfigured() || !navigator.onLine) return;
    const queue = readPendingQueue();
    if (queue.length === 0) return;

    const remaining: QueuedFeedbackPayload[] = [];
    for (let i = 0; i < queue.length; i++) {
      try {
        await postToGoogleForm(queue[i]);
      } catch {
        remaining.push(...queue.slice(i));
        break;
      }
    }
    writePendingQueue(remaining);
  }, []);

  useEffect(() => {
    void flushPendingQueue();
    const onOnline = () => {
      void flushPendingQueue();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
    };
  }, [flushPendingQueue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || status === 'submitting') return;

    setStatus('submitting');
    const payload: QueuedFeedbackPayload = {
      id: `fb_${Date.now()}`,
      message: trimmed,
      diagnostics: buildAutoDiagnosticsSnapshot(),
      createdAt: new Date().toISOString(),
    };

    if (!isFeedbackFormConfigured() || !navigator.onLine) {
      const existing = readPendingQueue();
      writePendingQueue([...existing, payload]);
      setMessage('');
      setStatus('queued');
      return;
    }

    try {
      await postToGoogleForm(payload);
      setMessage('');
      setStatus('sent');
    } catch {
      const existing = readPendingQueue();
      writePendingQueue([...existing, payload]);
      setMessage('');
      setStatus('queued');
    }
  };

  return (
    <section
      aria-label="Feedback and Problems"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#050508]/95 px-4 pb-6 pt-16 backdrop-blur-md"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0a0a10]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.9)] md:p-8"
      >
        <div className="mb-5 flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-white md:text-xl">
            What is the problem?
          </h1>
          <h2
            dir="rtl"
            className="text-lg font-semibold text-sky-300 md:text-xl"
          >
            إيه المشكلة؟
          </h2>
        </div>

        <textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          rows={6}
          dir="auto"
          placeholder="Describe the issue or suggestion... / اكتب المشكلة أو الاقتراح هنا..."
          className="w-full resize-y rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        />

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[20px] text-xs">
            {status === 'sent' && (
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Sent — thank you! · تم الإرسال، شكراً لمشاركتك!</span>
              </span>
            )}
            {status === 'queued' && (
              <span className="inline-flex items-center gap-1.5 text-sky-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Saved locally & will send automatically when connected · تم الحفظ وسيتم الإرسال تلقائياً
                </span>
              </span>
            )}
            {status === 'error' && (
              <span className="text-rose-400">
                Could not send right now · تعذر الإرسال حالياً
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!message.trim() || status === 'submitting'}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/20 px-5 py-2.5 text-xs font-semibold tracking-wide text-sky-200 transition-all hover:border-sky-400/60 hover:bg-sky-500/30 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === 'submitting' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>Send · إرسال</span>
          </button>
        </div>
      </form>
    </section>
  );
};
