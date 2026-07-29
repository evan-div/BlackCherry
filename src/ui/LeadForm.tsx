import { useState } from 'react';
import type { FormEvent } from 'react';
import type { HotspotLead } from '../config/types';

interface LeadFormProps {
  hotspotId: string;
  /** CTA button label; also the form's submit label. */
  label: string;
  onSubmit: (lead: HotspotLead) => void | Promise<void>;
}

type Status = 'idle' | 'open' | 'submitting' | 'done' | 'error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Inline lead-capture CTA for a hotspot card. Starts as a single button; clicking
 * it reveals a compact name/email/message form. On submit it calls the host's
 * handler (awaiting a returned promise so a real network call keeps the button in
 * its "Sending…" state), then shows a thank-you — or an error with a retry.
 */
export function LeadForm({ hotspotId, label, onSubmit }: LeadFormProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !EMAIL_RE.test(email)) {
      setStatus('error');
      return;
    }
    setStatus('submitting');
    try {
      await onSubmit({ hotspotId, name: name.trim(), email: email.trim(), message: message.trim() || undefined });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'idle') {
    return (
      <button type="button" className="tse-btn tse-btn--accent" onClick={() => setStatus('open')}>
        {label}
      </button>
    );
  }

  if (status === 'done') {
    return (
      <div className="tse-lead-form__done" role="status">
        Thanks — we'll be in touch shortly.
      </div>
    );
  }

  const submitting = status === 'submitting';

  return (
    <form className="tse-lead-form" onSubmit={handleSubmit} noValidate>
      <input
        className="tse-lead-form__input"
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        disabled={submitting}
        required
      />
      <input
        className="tse-lead-form__input"
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        disabled={submitting}
        required
      />
      <textarea
        className="tse-lead-form__input tse-lead-form__textarea"
        placeholder="Anything you'd like us to know? (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        disabled={submitting}
      />
      {status === 'error' && (
        <div className="tse-lead-form__error" role="alert">
          Please enter your name and a valid email, then try again.
        </div>
      )}
      <button type="submit" className="tse-btn tse-btn--accent" disabled={submitting}>
        {submitting ? 'Sending…' : label}
      </button>
    </form>
  );
}
