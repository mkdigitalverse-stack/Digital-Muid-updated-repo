import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  User as UserIcon,
  Mail,
  Phone,
  Briefcase,
  FileText,
  Image as ImageIcon,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Save,
  RotateCcw,
  KeyRound,
  Calendar,
  Sparkles,
  ExternalLink,
  Award,
  Download,
  Hash,
  CreditCard,
  Receipt,
  RefreshCw,
  Copy,
  Check,
  ArrowRight,
  BookOpen,
  UserCheck
} from 'lucide-react';
import { Certificate, PaymentRecord } from '../types';
import { CourseCertificateCelebrationModal } from '../components/CourseCertificateCelebrationModal';
import { downloadCertificatePdf, downloadInvoicePdf } from '../utils/pdfGenerator';

interface AccountPageProps {
  navigate: (path: string) => void;
  initialTab?: 'profile' | 'security' | 'certificates' | 'billing';
}

type ActiveTab = 'profile' | 'security' | 'certificates' | 'billing';

export const AccountPage: React.FC<AccountPageProps> = ({ navigate, initialTab }) => {
  const {
    currentUser,
    userProfile,
    isStudentAuthenticated,
    isAuthLoading,
    updateStudentProfile,
    updatePassword,
    studentLogout,
    studentCertificates,
    studentPayments,
    isPaymentsLoading,
    paymentsError,
    fetchStudentPayments
  } = useApp();

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (initialTab) return initialTab;
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'billing' || tabParam === 'security' || tabParam === 'certificates' || tabParam === 'profile') {
        return tabParam as ActiveTab;
      }
    } catch {}
    return 'profile';
  });

  const [selectedCertForModal, setSelectedCertForModal] = useState<Certificate | null>(null);
  const [copiedPaymentId, setCopiedPaymentId] = useState<string | null>(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const [billingSubFilter, setBillingSubFilter] = useState<'all' | 'courses' | 'consultations'>('all');

  // Synchronize initialTab or URL query parameter
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else {
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam === 'billing' || tabParam === 'security' || tabParam === 'certificates' || tabParam === 'profile') {
          setActiveTab(tabParam as ActiveTab);
        }
      } catch {}
    }
  }, [initialTab]);

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Profile State Status
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Security Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Security State Status
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Authentication Guard
  useEffect(() => {
    if (!isAuthLoading && !currentUser && !isStudentAuthenticated) {
      navigate('/login');
    }
  }, [isAuthLoading, currentUser, isStudentAuthenticated, navigate]);

  // Sync profile data to form state
  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName || '');
      setPhone(userProfile.phone || '');
      setHeadline(userProfile.headline || '');
      setBio(userProfile.bio || '');
      setAvatarUrl(userProfile.avatarUrl || '');
    } else if (currentUser) {
      const fallbackName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        currentUser.email?.split('@')[0] ||
        '';
      setFullName(fallbackName);
    }
  }, [userProfile, currentUser]);

  // Compute initials for avatar fallback
  const displayName =
    fullName.trim() ||
    userProfile?.fullName ||
    currentUser?.user_metadata?.full_name ||
    currentUser?.email?.split('@')[0] ||
    'Student';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'ST';

  const memberSince = currentUser?.created_at
    ? new Date(currentUser.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Member';

  // Handle Profile Submission
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    if (!fullName.trim()) {
      setProfileErrorMsg('Full name cannot be blank.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await updateStudentProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        headline: headline.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined
      });

      if (res.success) {
        setProfileSuccessMsg('Profile updated successfully.');
      } else {
        setProfileErrorMsg(res.error || 'Failed to update profile.');
      }
    } catch (err: any) {
      setProfileErrorMsg(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Reset Profile Form
  const handleResetProfile = () => {
    if (userProfile) {
      setFullName(userProfile.fullName || '');
      setPhone(userProfile.phone || '');
      setHeadline(userProfile.headline || '');
      setBio(userProfile.bio || '');
      setAvatarUrl(userProfile.avatarUrl || '');
    }
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
  };

  // Handle Password Update
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMsg(null);
    setPasswordErrorMsg(null);

    if (!newPassword) {
      setPasswordErrorMsg('Please enter a new password.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordErrorMsg('Password must be at least 8 characters long for security.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('Passwords do not match. Please verify and re-type.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await updatePassword(newPassword);
      if (res.success) {
        setPasswordSuccessMsg('Your password has been changed successfully.');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordErrorMsg(res.error || 'Failed to update password.');
      }
    } catch (err: any) {
      setPasswordErrorMsg(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogout = async () => {
    await studentLogout();
    navigate('/');
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-20 bg-[#0B1526]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
            Loading Account Details...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header Banner */}
      <div className="bg-[#0B1526] border-b border-slate-800 text-white pt-10 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* Identity Card */}
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700/80 shadow-xl overflow-hidden flex items-center justify-center shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        // Fallback on broken image URL
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span className={`text-2xl sm:text-3xl font-bold font-display text-white ${avatarUrl ? 'hidden' : 'block'}`}>
                    {initials}
                  </span>
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#0B1526] flex items-center justify-center shadow-md" title="Active Account">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold font-display text-white">
                    {displayName}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs font-semibold uppercase tracking-wider">
                    Student / Member
                  </span>
                </div>
                <p className="text-sm text-slate-300 font-sans">
                  {headline || 'Digital Transformation & Growth Learner'}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono pt-1">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    {currentUser.email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Member since {memberSince}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold tracking-wide border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Dashboard</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-semibold tracking-wide border border-red-800/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 pt-8 border-t border-slate-800/80 mt-8">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[#FF6B00] text-white shadow-md'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>Profile Information</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-[#FF6B00] text-white shadow-md'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Security & Account</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('certificates')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'certificates'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Certificates ({studentCertificates.length})</span>
            </button>
            <button
              id="account-tab-billing-btn"
              type="button"
              onClick={() => setActiveTab('billing')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'billing'
                  ? 'bg-[#FF6B00] text-white shadow-md'
                  : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Billing & Invoices {studentPayments.length > 0 ? `(${studentPayments.length})` : ''}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4">
        {activeTab === 'profile' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Form Inputs */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-display">
                    Personal Information
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Update your student profile details. These appear on your course certificates and consultation requests.
                  </p>
                </div>

                {profileSuccessMsg && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-800">Saved Successfully</h4>
                      <p className="text-xs text-emerald-700 mt-0.5">{profileSuccessMsg}</p>
                    </div>
                  </div>
                )}

                {profileErrorMsg && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-red-800">Update Failed</h4>
                      <p className="text-xs text-red-700 mt-0.5">{profileErrorMsg}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-5">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Muid Khan"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none text-sm text-slate-900 placeholder:text-slate-400 transition-all"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Phone Number (Optional)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none text-sm text-slate-900 placeholder:text-slate-400 transition-all"
                      />
                    </div>
                  </div>

                  {/* Professional Headline */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Professional Headline / Company
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        placeholder="e.g. Head of Marketing @ GrowthVentures | AI Strategist"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none text-sm text-slate-900 placeholder:text-slate-400 transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Use this field to highlight your company, role, or strategic industry focus.
                    </p>
                  </div>

                  {/* Avatar URL */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Profile Picture URL
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <input
                        type="url"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://example.com/my-photo.jpg"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none text-sm text-slate-900 placeholder:text-slate-400 transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Provide a direct web link (e.g. LinkedIn, GitHub, or image host URL).
                    </p>
                  </div>

                  {/* Bio */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Short Bio / Learning Goals
                    </label>
                    <div className="relative">
                      <textarea
                        rows={4}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Share a brief overview of your business goals, target skills, or focus areas..."
                        className="w-full p-3.5 rounded-xl border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none text-sm text-slate-900 placeholder:text-slate-400 transition-all resize-y"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={handleResetProfile}
                      disabled={isSavingProfile}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="px-6 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-orange-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingProfile ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Preview & Status */}
            <div className="space-y-6">
              {/* Profile Card Preview */}
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Live Profile Preview
                  </h3>
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-mono font-semibold">
                    Live Sync
                  </span>
                </div>

                <div className="text-center space-y-3">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-200 shadow-md overflow-hidden flex items-center justify-center">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    <span className={`text-2xl font-bold font-display text-white ${avatarUrl ? 'hidden' : 'block'}`}>
                      {initials}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-slate-900 font-display">
                      {displayName}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      {headline || 'Digital Growth Learner'}
                    </p>
                  </div>

                  {bio && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 text-left line-clamp-4 leading-relaxed italic">
                      "{bio}"
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Contact Phone</span>
                    <span className="font-mono text-slate-700">{phone || 'Not set'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Account Email</span>
                    <span className="font-mono text-slate-700">{currentUser.email}</span>
                  </div>
                </div>
              </div>

              {/* Learning Benefits Card */}
              <div className="bg-[#0B1526] text-white rounded-3xl p-6 space-y-3 border border-slate-800">
                <div className="flex items-center gap-2 text-[#FF6B00] text-xs font-bold uppercase tracking-wider font-mono">
                  <Sparkles className="w-4 h-4" />
                  <span>Student Portal</span>
                </div>
                <h4 className="text-sm font-bold font-display text-white">
                  Accelerate Your Transformation
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Keeping your headline and bio up-to-date helps personalize your 1-on-1 consultations and certification credentials.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/my-courses')}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>View Enrolled Courses</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'security' ? (
          /* Security & Account Information Tab */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Change Password */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-[#FF6B00]" />
                    <span>Change Password</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Set a new secure password for your Digital Muid student account.
                  </p>
                </div>

                {passwordSuccessMsg && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-800">Password Changed</h4>
                      <p className="text-xs text-emerald-700 mt-0.5">{passwordSuccessMsg}</p>
                    </div>
                  </div>
                )}

                {passwordErrorMsg && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-red-800">Password Change Failed</h4>
                      <p className="text-xs text-red-700 mt-0.5">{passwordErrorMsg}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        required
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none text-sm text-slate-900 placeholder:text-slate-400 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        required
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none text-sm text-slate-900 placeholder:text-slate-400 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#0B1526] hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isUpdatingPassword ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 text-[#FF6B00]" />
                          <span>Update Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Account Information (Read-only) */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Account Identity & Security
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Official Supabase verified credentials.
                  </p>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Verified Email
                    </span>
                    <div className="text-sm font-semibold text-slate-900 font-mono break-all">
                      {currentUser.email}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Account ID (UUID)
                    </span>
                    <div className="text-[11px] font-mono text-slate-600 break-all select-all">
                      {currentUser.id}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Session Status
                    </span>
                    <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Authenticated & Active</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Account Created
                    </span>
                    <div className="text-slate-700 font-medium">
                      {memberSince}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider border border-red-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span>Sign Out of Account</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'certificates' ? (
          /* Certificates Tab Content */
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 font-display">
                    Course Certificates & Credentials
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Official verified certificates of completion earned across Digital Muid executive masterclasses.
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-600 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 self-start sm:self-auto">
                  {studentCertificates.length} {studentCertificates.length === 1 ? 'Credential' : 'Credentials'} Issued
                </div>
              </div>

              {studentCertificates.length === 0 ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                    <Award className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900 font-display">
                      No Certificates Earned Yet
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Complete 100% of all lessons in an enrolled masterclass to receive your official Certificate of Completion.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/my-courses')}
                    className="px-5 py-2.5 bg-[#0F172A] hover:bg-[#FF6B00] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                  >
                    View Enrolled Courses
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                  {studentCertificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="bg-white border-2 border-amber-500/30 rounded-3xl p-6 shadow-md space-y-6 flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                            <Award className="w-6 h-6 text-[#FF6B00]" />
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </span>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 font-mono">
                            Certificate of Completion
                          </div>
                          <h3 className="text-lg font-display font-bold text-slate-900 mt-1 leading-snug">
                            {cert.courseTitle}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Issued to <span className="font-semibold text-slate-800">{cert.recipientName}</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                          <div className="p-2.5 bg-slate-50 rounded-xl">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              <Hash className="w-3 h-3 text-slate-500" />
                              <span>Credential ID</span>
                            </div>
                            <div className="font-mono font-semibold text-slate-800 text-[11px] truncate mt-0.5">
                              {cert.certificateNumber}
                            </div>
                          </div>

                          <div className="p-2.5 bg-slate-50 rounded-xl">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>Issued On</span>
                            </div>
                            <div className="font-semibold text-slate-800 text-[11px] truncate mt-0.5">
                              {new Date(cert.issuedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            downloadCertificatePdf({
                              certificateNumber: cert.certificateNumber,
                              recipientName: cert.recipientName,
                              courseTitle: cert.courseTitle,
                              issuedAt: cert.issuedAt,
                              verificationHash: cert.verificationHash
                            })
                          }
                          className="flex-1 py-2.5 px-3 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5 text-[#FF6B00]" />
                          <span>Download PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate(`/verify-certificate/${cert.verificationHash}`)}
                          className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Public Verification Page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Verify</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedCertForModal(cert)}
                          className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Award className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Billing & Invoices Tab (Phase 2J) */
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-widest bg-orange-50 text-[#FF6B00] border border-orange-100">
                      Payment History & Tax Invoices
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 font-display">
                    Billing & Receipts
                  </h2>
                  <p className="text-xs text-slate-500">
                    Official transaction records, verified payment receipts, and invoices for enrolled masterclasses and advisory sessions.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fetchStudentPayments()}
                    disabled={isPaymentsLoading}
                    className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    title="Refresh payment records"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPaymentsLoading ? 'animate-spin text-[#FF6B00]' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Error Notice */}
              {paymentsError && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-bold uppercase tracking-wider">Notice loading payment history</div>
                    <p className="text-amber-800">{paymentsError}</p>
                  </div>
                </div>
              )}

              {/* Billing Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Total Captured
                    </span>
                    <div className="text-2xl font-bold font-mono text-slate-900">
                      ₹{studentPayments
                        .filter((p) => p.status === 'captured')
                        .reduce((acc, p) => acc + (p.amount || 0), 0)
                        .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Transactions
                    </span>
                    <div className="text-2xl font-bold font-mono text-slate-900">
                      {studentPayments.length}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Account Status
                    </span>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Verified Student</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Transactions List / Empty State */}
              {isPaymentsLoading && studentPayments.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
                    Querying Payment Ledger...
                  </p>
                </div>
              ) : studentPayments.length === 0 ? (
                <div className="py-16 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-4 max-w-lg mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 text-[#FF6B00] flex items-center justify-center mx-auto">
                    <Receipt className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold font-display text-slate-900">
                      No Payment Records Found
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-sans">
                      You have no recorded payment transactions or invoices under your account. When you purchase an executive masterclass enrollment or confirm a paid consultation, official receipts will be archived here.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/learn')}
                      className="px-4 py-2 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <span>Explore Courses</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/consultation')}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 cursor-pointer"
                    >
                      <span>Book Consultation</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Category Filter Tabs */}
                  {(() => {
                    const coursePayments = studentPayments.filter((p) => p.itemType === 'course');
                    const consultationPayments = studentPayments.filter((p) => p.itemType === 'consultation');
                    const displayedPayments =
                      billingSubFilter === 'courses'
                        ? coursePayments
                        : billingSubFilter === 'consultations'
                        ? consultationPayments
                        : studentPayments;

                    return (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setBillingSubFilter('all')}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                                billingSubFilter === 'all'
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                  : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              All Purchases ({studentPayments.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setBillingSubFilter('courses')}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                                billingSubFilter === 'courses'
                                  ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-xs'
                                  : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Paid Courses ({coursePayments.length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setBillingSubFilter('consultations')}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                                billingSubFilter === 'consultations'
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                  : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Paid Consultations ({consultationPayments.length})</span>
                            </button>
                          </div>

                          <span className="text-[11px] font-mono text-slate-500">
                            Showing {displayedPayments.length} of {studentPayments.length} records
                          </span>
                        </div>

                        {displayedPayments.length === 0 ? (
                          <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-3 max-w-md mx-auto">
                            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                              {billingSubFilter === 'courses' ? (
                                <BookOpen className="w-6 h-6 text-[#FF6B00]" />
                              ) : (
                                <UserCheck className="w-6 h-6 text-purple-600" />
                              )}
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-slate-900">
                                {billingSubFilter === 'courses'
                                  ? 'No Paid Course Purchases Found'
                                  : 'No Paid Consultation Purchases Found'}
                              </h4>
                              <p className="text-xs text-slate-500">
                                {billingSubFilter === 'courses'
                                  ? 'You have not completed any course masterclass transactions yet.'
                                  : 'You have not booked or completed any paid advisory consultation sessions yet.'}
                              </p>
                            </div>
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => navigate(billingSubFilter === 'courses' ? '/learn' : '/consultation')}
                                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-[#FF6B00] text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <span>{billingSubFilter === 'courses' ? 'Browse Masterclasses' : 'Book a Consultation'}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="hidden md:block overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 text-slate-500 font-mono uppercase tracking-wider">
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Description</th>
                                    <th className="py-3 px-4">Category</th>
                                    <th className="py-3 px-4">Amount</th>
                                    <th className="py-3 px-4">Payment Status</th>
                                    <th className="py-3 px-4">Payment Ref</th>
                                    <th className="py-3 px-4 text-right">Receipt</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {displayedPayments.map((p) => {
                                    const isCaptured = p.status === 'captured';
                                    const isPending = p.status === 'pending';
                                    const isFailed = p.status === 'failed';
                                    const isRefunded = p.status === 'refunded';
                                    const isCourse = p.itemType === 'course';

                                    let formattedDate = 'Recent';
                                    try {
                                      const d = new Date(p.createdAt);
                                      if (!isNaN(d.getTime())) {
                                        formattedDate = d.toLocaleDateString('en-IN', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric'
                                        });
                                      }
                                    } catch {}

                                    return (
                                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-4 px-4 font-mono text-slate-600 whitespace-nowrap">
                                          {formattedDate}
                                        </td>
                                        <td className="py-4 px-4 font-medium text-slate-900 max-w-xs">
                                          <div className="truncate font-semibold">{p.itemTitle || (isCourse ? 'Course Masterclass' : 'Consultation Session')}</div>
                                          {p.razorpayOrderId && (
                                            <div className="text-[10px] font-mono text-slate-400 truncate">
                                              Order: {p.razorpayOrderId}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-4 px-4">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                                            isCourse
                                              ? 'bg-orange-50 text-[#FF6B00] border border-orange-200'
                                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                                          }`}>
                                            {isCourse ? 'Course' : 'Consultation'}
                                          </span>
                                        </td>
                                        <td className="py-4 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                                          {p.currency || 'INR'} {p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-4 px-4 whitespace-nowrap">
                                          <span
                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                                              isCaptured
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : isPending
                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                : isRefunded
                                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                            }`}
                                          >
                                            <span
                                              className={`w-1.5 h-1.5 rounded-full ${
                                                isCaptured
                                                  ? 'bg-emerald-500'
                                                  : isPending
                                                  ? 'bg-amber-500'
                                                  : isRefunded
                                                  ? 'bg-purple-500'
                                                  : 'bg-rose-500'
                                              }`}
                                            />
                                            <span>{isCaptured ? 'Paid' : p.status}</span>
                                          </span>
                                        </td>
                                        <td className="py-4 px-4">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-[11px] text-slate-600 truncate max-w-[110px]" title={p.razorpayPaymentId || p.id}>
                                              {p.razorpayPaymentId || p.id.slice(0, 12)}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const text = p.razorpayPaymentId || p.id;
                                                navigator.clipboard.writeText(text);
                                                setCopiedPaymentId(p.id);
                                                setTimeout(() => setCopiedPaymentId(null), 2000);
                                              }}
                                              className="text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                                              title="Copy Payment ID"
                                            >
                                              {copiedPaymentId === p.id ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                              ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                              )}
                                            </button>
                                          </div>
                                        </td>
                                        <td className="py-4 px-4 text-right whitespace-nowrap">
                                          <div className="flex items-center justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setDownloadingReceiptId(p.id);
                                                try {
                                                  downloadInvoicePdf({
                                                    paymentId: p.razorpayPaymentId || p.id,
                                                    orderId: p.razorpayOrderId,
                                                    customerName: userProfile?.fullName || currentUser?.user_metadata?.full_name || 'Valued Student',
                                                    customerEmail: currentUser?.email || '',
                                                    itemTitle: p.itemTitle || (isCourse ? 'Digital Muid Masterclass' : 'Digital Muid Consultation'),
                                                    itemType: p.itemType,
                                                    amount: p.amount,
                                                    currency: p.currency || 'INR',
                                                    paymentDate: p.createdAt,
                                                    status: p.status,
                                                    invoiceUrl: p.invoiceUrl
                                                  });
                                                } finally {
                                                  setTimeout(() => setDownloadingReceiptId(null), 500);
                                                }
                                              }}
                                              disabled={downloadingReceiptId === p.id}
                                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-[#FF6B00] text-white text-[11px] font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60"
                                            >
                                              <Download className="w-3 h-3 text-[#FF6B00] group-hover:text-white" />
                                              <span>{downloadingReceiptId === p.id ? 'Generating...' : 'Receipt'}</span>
                                            </button>

                                            {p.invoiceUrl && (
                                              <a
                                                href={p.invoiceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                                title="External Invoice"
                                              >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                              </a>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Mobile Responsive Cards (< md) */}
                            <div className="grid grid-cols-1 gap-3 md:hidden">
                              {displayedPayments.map((p) => {
                                const isCaptured = p.status === 'captured';
                                const isCourse = p.itemType === 'course';
                                let formattedDate = 'Recent';
                                try {
                                  const d = new Date(p.createdAt);
                                  if (!isNaN(d.getTime())) {
                                    formattedDate = d.toLocaleDateString('en-IN', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    });
                                  }
                                } catch {}

                                return (
                                  <div
                                    key={p.id}
                                    className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[10px] font-mono text-slate-500">{formattedDate}</span>
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                                            isCourse ? 'bg-orange-50 text-[#FF6B00]' : 'bg-purple-50 text-purple-700'
                                          }`}>
                                            {isCourse ? 'Course' : 'Consultation'}
                                          </span>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-900">{p.itemTitle || (isCourse ? 'Course Masterclass' : 'Consultation Session')}</h4>
                                      </div>
                                      <span className="font-mono font-bold text-slate-900 text-sm">
                                        {p.currency || 'INR'} {p.amount.toLocaleString('en-IN')}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                          isCaptured
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-slate-100 text-slate-700'
                                        }`}
                                      >
                                        {p.status}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          downloadInvoicePdf({
                                            paymentId: p.razorpayPaymentId || p.id,
                                            orderId: p.razorpayOrderId,
                                            customerName: userProfile?.fullName || currentUser?.user_metadata?.full_name || 'Valued Student',
                                            customerEmail: currentUser?.email || '',
                                            itemTitle: p.itemTitle || (isCourse ? 'Digital Muid Masterclass' : 'Digital Muid Consultation'),
                                            itemType: p.itemType,
                                            amount: p.amount,
                                            currency: p.currency || 'INR',
                                            paymentDate: p.createdAt,
                                            status: p.status,
                                            invoiceUrl: p.invoiceUrl
                                          });
                                        }}
                                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                                      >
                                        <Download className="w-3 h-3 text-[#FF6B00]" />
                                        <span>Receipt PDF</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Certificate Modal */}
      {selectedCertForModal && (
        <CourseCertificateCelebrationModal
          isOpen={Boolean(selectedCertForModal)}
          onClose={() => setSelectedCertForModal(null)}
          certificate={selectedCertForModal}
          courseTitle={selectedCertForModal.courseTitle}
          recipientName={selectedCertForModal.recipientName}
          navigate={navigate}
        />
      )}
    </div>
  );
};
