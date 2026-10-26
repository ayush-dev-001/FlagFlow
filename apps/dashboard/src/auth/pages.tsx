import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, api } from '../api/client';
import { formText } from '../ui/form';
import { Alert, Button, Field, Spinner } from '../ui/primitives';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './AuthProvider';
import type { MirrorStatus } from './illustration/LoginIllustration';
import { useFormMirror } from './illustration/useFormMirror';

const linkClass = 'font-semibold text-lime hover:underline';

/** Turns an API error into a top-level message plus per-field messages. */
function useFormError() {
  const [error, setError] = useState<ApiError | null>(null);
  return {
    failed: error !== null,
    error,
    setError: (e: unknown) =>
      setError(e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', 'Something went wrong. Try again.')),
    clear: () => setError(null),
    field: (name: string) => error?.fieldError(name),
    banner: error && error.code !== 'VALIDATION_ERROR' ? error.message : null,
  };
}

/** A submit's progress, plus the illustration mirroring the form it belongs to. */
function useSubmit(failed: boolean) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const status: MirrorStatus = done ? 'success' : submitting ? 'submitting' : failed ? 'error' : 'idle';
  const { mirror, handlers } = useFormMirror(status);
  return { submitting, setSubmitting, setDone, mirror, handlers };
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const form = useFormError();
  const { submitting, setSubmitting, setDone, mirror, handlers } = useSubmit(form.failed);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSubmitting(true);
    form.clear();
    try {
      await login(formText(data, 'email'), formText(data, 'password'));
      setDone(true);
      void navigate('/', { replace: true });
    } catch (err) {
      form.setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome Back"
      mirror={mirror}
      subtitle={
        <>
          New to FlagFlow?{' '}
          <Link to="/register" className={linkClass}>
            Create an organization
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} {...handlers} className="flex flex-col gap-4" noValidate>
        {form.banner && <Alert>{form.banner}</Alert>}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={form.field('email')}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={form.field('password')}
        />
        <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
          Log in
        </Button>
        <p className="text-[13px] text-subtle">Joining a team? Use the invite link in your email.</p>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const form = useFormError();
  const { submitting, setSubmitting, setDone, mirror, handlers } = useSubmit(form.failed);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSubmitting(true);
    form.clear();
    try {
      await register({
        name: formText(data, 'name'),
        email: formText(data, 'email'),
        password: formText(data, 'password'),
        organizationName: formText(data, 'organizationName'),
      });
      setDone(true);
      void navigate('/welcome', { replace: true });
    } catch (err) {
      form.setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create Your Organization"
      mirror={mirror}
      subtitle={
        <>
          Already have an account?{' '}
          <Link to="/login" className={linkClass}>
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} {...handlers} className="flex flex-col gap-4" noValidate>
        {form.banner && <Alert>{form.banner}</Alert>}
        <Field
          label="Organization name"
          name="organizationName"
          autoComplete="organization"
          required
          error={form.field('organizationName')}
        />
        <Field label="Your name" name="name" autoComplete="name" required error={form.field('name')} />
        <Field
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={form.field('email')}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters."
          required
          error={form.field('password')}
        />
        <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
          Create organization
        </Button>
      </form>
    </AuthLayout>
  );
}

interface InvitePreview {
  email: string;
  role: 'ADMIN' | 'MEMBER';
  organization: { name: string };
}

export function InvitePage() {
  const { token = '' } = useParams();
  const { acceptInvite, status, user, logout } = useAuth();
  const navigate = useNavigate();
  const form = useFormError();
  const { submitting, setSubmitting, setDone, mirror, handlers } = useSubmit(form.failed);
  const preview = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api<InvitePreview>(`/auth/invites/${encodeURIComponent(token)}`, { auth: false }),
    retry: false,
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSubmitting(true);
    form.clear();
    try {
      await acceptInvite(token, { name: formText(data, 'name'), password: formText(data, 'password') });
      setDone(true);
      void navigate('/', { replace: true });
    } catch (err) {
      form.setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (preview.isPending) {
    return (
      <AuthLayout title="Join Your Team">
        <Spinner label="Checking your invite" />
      </AuthLayout>
    );
  }

  if (preview.isError) {
    return (
      <AuthLayout title="This Invite Can't Be Used">
        <Alert>
          {preview.error instanceof ApiError && preview.error.status === 404
            ? 'The link is invalid, has expired, or was already used. Ask an admin of your organization to send a new invite.'
            : 'Could not check the invite. Try again in a moment.'}
        </Alert>
        <p className="mt-6 text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className={linkClass}>
            Log in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  const invite = preview.data;
  const role = invite.role === 'ADMIN' ? 'an admin' : 'a member';

  if (status === 'authed' && user) {
    return (
      <AuthLayout title={`Join ${invite.organization.name}`}>
        <p className="text-sm text-muted">
          You're logged in as <span className="text-text">{user.email}</span>. This invite is for{' '}
          <span className="text-text">{invite.email}</span>. Log out to accept it.
        </p>
        <Button variant="secondary" size="lg" className="mt-6 w-full" onClick={() => void logout()}>
          Log out
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={`Join ${invite.organization.name}`}
      mirror={mirror}
      subtitle={
        <>
          You're joining as {role} with <span className="text-text">{invite.email}</span>.
        </>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} {...handlers} className="flex flex-col gap-4" noValidate>
        {form.banner && <Alert>{form.banner}</Alert>}
        <Field label="Your name" name="name" autoComplete="name" required error={form.field('name')} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters."
          required
          error={form.field('password')}
        />
        <Button type="submit" size="lg" loading={submitting} className="mt-2 w-full">
          Join {invite.organization.name}
        </Button>
      </form>
    </AuthLayout>
  );
}
