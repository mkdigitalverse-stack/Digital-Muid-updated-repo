import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  GraduationCap,
  LogOut,
  Loader2,
  HelpCircle,
  ChevronRight,
  LayoutDashboard,
  BookOpen
} from 'lucide-react';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  navigate: (path: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login', navigate }) => {
  const {
    currentUser,
    userProfile,
    isStudentAuthenticated,
    isAdminAuthenticated,
    isAuthLoading,
    studentLogin,
    studentRegister,
    studentLogout,
    requestPasswordReset,
    adminLogout
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync mode if initialMode prop changes
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Clear messages on mode switch
  const handleSwitchMode = (targetMode: 'login' | 'register' | 'forgot') => {
    setMode(targetMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      setIsSubmitting(true);
      try {
        const res = await requestPasswordReset(cleanEmail);
        if (res.success) {
          setSuccessMessage('Password reset link has been dispatched to your email address.');
        } else {
          setErrorMessage(res.error || 'Failed to send password reset request.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'An unexpected error occurred.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (mode === 'register') {
      const cleanName = fullName.trim();
      if (!cleanName) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (cleanName.length < 2) {
        setErrorMessage('Full name must be at least 2 characters long.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must contain at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please verify.');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await studentRegister(cleanEmail, password, cleanName);
        if (res.success) {
          setSuccessMessage('Account registered successfully!');
          const redirectPath = sessionStorage.getItem('auth_redirect');
          if (redirectPath) {
            sessionStorage.removeItem('auth_redirect');
            setTimeout(() => navigate(redirectPath), 600);
          }
        } else {
          setErrorMessage(res.error || 'Registration failed. Please check your details.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Registration failed unexpectedly.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Login mode
      setIsSubmitting(true);
      try {
        const res = await studentLogin(cleanEmail, password);
        if (res.success) {
          setSuccessMessage('Signed in successfully!');
          const redirectPath = sessionStorage.getItem('auth_redirect');
          if (redirectPath) {
            sessionStorage.removeItem('auth_redirect');
            setTimeout(() => navigate(redirectPath), 600);
          }
        } else {
          setErrorMessage(res.error || 'Invalid credentials. Please verify your email and password.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Login failed unexpectedly.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // 1. Loading State while checking existing session
  if (isAuthLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-16 px-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0F172A] border border-slate-700/50 flex items-center justify-center mx-auto shadow-lg">
            <Loader2 className="w-6 h-6 text-[#FF6B00] animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest font-interface">
            Verifying Authentication Session...
          </p>
        </div>
      </div>
    );
  }

  // 2. Authenticated State View (Student or Admin Session Active)
  if (currentUser) {
    const displayName = userProfile?.fullName || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || 'Member';
    const initials = displayName
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'DM';

    return (
      <div className="min-h-[75vh] py-16 px-4 flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-xl p-8 sm:p-10 space-y-8">
          {/* Header Badge */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-bold text-lg font-display tracking-wider border border-slate-800">
                {initials}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 font-display">
                  {displayName}
                </h1>
                <p className="text-xs text-slate-500 font-mono">
                  {currentUser.email}
                </p>
              </div>
            </div>

            {isAdminAuthenticated ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
                Administrator
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-[#FF6B00] border border-orange-200 text-xs font-semibold">
                <GraduationCap className="w-3.5 h-3.5 text-[#FF6B00]" />
                Student / Member
              </span>
            )}
          </div>

          {/* Session Details */}
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Session Status</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Authenticated & Persistent
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Account ID</span>
                <span className="font-mono text-[11px] text-slate-700 truncate max-w-[200px]">
                  {currentUser.id}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Authentication Source</span>
                <span className="text-slate-700 font-medium">Supabase Auth (Official)</span>
              </div>
            </div>

            {isAdminAuthenticated ? (
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
                  <ShieldCheck className="w-4 h-4" />
                  Admin Control Panel Available
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  You are authenticated with full administrator permissions verified via PostgreSQL security definer rules.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="w-full py-2.5 px-4 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open Admin CMS</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-100/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider font-interface">
                    Student Learning Portal
                  </div>
                  <span className="px-2 py-0.5 rounded bg-orange-100 text-[#FF6B00] text-[10px] font-bold uppercase tracking-wider">
                    Active Student
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your student dashboard and learning progress are ready. Track your courses, continue learning, and master high-leverage frameworks.
                </p>
                {typeof window !== 'undefined' && sessionStorage.getItem('auth_redirect') && (
                  <button
                    type="button"
                    onClick={() => {
                      const redirectPath = sessionStorage.getItem('auth_redirect');
                      sessionStorage.removeItem('auth_redirect');
                      if (redirectPath) navigate(redirectPath);
                    }}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Continue to Course Enrollment</span>
                  </button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="py-2.5 px-4 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Go to Dashboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/my-courses')}
                    className="py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200 shadow-sm"
                  >
                    <BookOpen className="w-4 h-4 text-[#FF6B00]" />
                    <span>My Courses</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate('/learn')}
              className="flex-1 py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Explore Courses</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (isAdminAuthenticated) {
                  await adminLogout();
                } else {
                  await studentLogout();
                }
              }}
              className="flex-1 py-3 px-5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-red-200/60"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Unauthenticated Login / Register Form View
  return (
    <div className="min-h-[85vh] py-16 px-4 flex items-center justify-center bg-[#F8FAFC]">
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl shadow-xl p-8 sm:p-10 space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0F172A] text-white mx-auto shadow-md border border-slate-800">
            <GraduationCap className="w-6 h-6 text-[#FF6B00]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
            {mode === 'login' && 'Student & Member Sign In'}
            {mode === 'register' && 'Create Student Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {mode === 'login' && 'Access your enrolled courses and verified learning assets.'}
            {mode === 'register' && 'Join Digital Muid to unlock high-leverage frameworks and courses.'}
            {mode === 'forgot' && 'Enter your email to receive password recovery instructions.'}
          </p>
        </div>

        {/* Tab Switcher (Login vs Register) */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className={`py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('register')}
              className={`py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-800 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800 text-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{successMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-interface">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Aditi Sharma"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-interface">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent transition-all"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-interface">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgot')}
                    className="text-[11px] text-[#FF6B00] hover:underline font-medium cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-interface">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] focus:border-transparent transition-all"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 active:scale-[0.99] disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#FF6B00]" />
                <span>Processing Request...</span>
              </>
            ) : (
              <>
                <span>
                  {mode === 'login' && 'Sign In to Student Account'}
                  {mode === 'register' && 'Complete Student Registration'}
                  {mode === 'forgot' && 'Send Password Reset Link'}
                </span>
                <ArrowRight className="w-4 h-4 text-[#FF6B00]" />
              </>
            )}
          </button>
        </form>

        {/* Footer info / Back button */}
        <div className="pt-2 text-center text-xs text-slate-500">
          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className="text-[#FF6B00] hover:underline font-bold cursor-pointer inline-flex items-center gap-1"
            >
              ← Back to Sign In
            </button>
          ) : mode === 'login' ? (
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('register')}
                className="text-[#FF6B00] hover:underline font-bold cursor-pointer"
              >
                Create one now
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                className="text-[#FF6B00] hover:underline font-bold cursor-pointer"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
