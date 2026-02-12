import { Settings, UserPen, Trash2, Ban, FileText, Shield, Mail, ChevronRight, ArrowLeft } from 'lucide-react';
import emailjs from "@emailjs/browser";
import { useRef, useState, useEffect} from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { useBlocks } from '@/contexts/BlockContext';
import { getProfile, UserProfile } from '@/services/firestore';
import { unblockUser } from '@/services/blockReportService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { deleteUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { deleteUserCompletely } from '@/services/firestore';


interface SettingsPageProps {
  userProfile?: UserProfile | null;
  onNavigate: (page: string) => void;
  onEditProfile?: () => void;
  onDeleteProfile?: () => void;
}

type SettingsSubPage = 'menu' | 'blocked-users' | 'terms' | 'privacy' | 'contact';

const SettingsPage = ({ userProfile, onNavigate, onEditProfile, onDeleteProfile }: SettingsPageProps) => {
  const [subPage, setSubPage] = useState<SettingsSubPage>('menu');

  const formRef = useRef<HTMLFormElement>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const sendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;

    setSendingEmail(true);

    emailjs
      .sendForm(
        "service_ga46jnw",
        "template_l6xkuaj",
        formRef.current,
        "NTQ_HSkYjufQlVakK"
      )
      .then(() => {
        alert("Message sent successfully!");
        formRef.current?.reset();
      })
      .catch((error) => {
        console.error(error);
        alert("Failed to send message. Please try again.");
      })
      .finally(() => setSendingEmail(false));
  };

  const handleDeleteProfile = async () => {
  const confirmText = prompt(
    "This will permanently delete your account.\nType DELETE to continue."
  );
  
  if (confirmText !== "DELETE") {
    toast("Deletion cancelled");
    return;
  }
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No authenticated user");
    
    // Delete user data from Firestore
    await deleteUserCompletely(currentUser.uid);
    
    // Delete Firebase Auth account
    await deleteUser(currentUser);
    
    toast.success("Account deleted successfully");
    
    // Redirect to home
    window.location.href = "/";
  } catch (err: any) {
    console.error('Delete account error:', err);
    toast.error(err.message || "Failed to delete account");
  }
};

  const menuItems = [
    {
      id: 'edit-profile' as const,
      label: 'Edit Profile',
      icon: UserPen,
      description: 'Update your name, bio, skills and more',
      action: () => onEditProfile?.(),
    },
    {
        id: 'delete-profile' as const,
        label: 'Delete Account',
        icon: Trash2,
        description: 'Permanently delete your account and data',
        danger: true,
        action: handleDeleteProfile, 
    },
    
    {
      id: 'blocked-users' as const,
      label: 'Blocked Users',
      icon: Ban,
      description: 'View and manage blocked users',
      action: () => setSubPage('blocked-users'),
    },
    {
      id: 'terms' as const,
      label: 'Terms & Conditions',
      icon: FileText,
      description: 'Read our terms of service',
      action: () => setSubPage('terms'),
    },
    {
      id: 'privacy' as const,
      label: 'Privacy Policy',
      icon: Shield,
      description: 'How we handle your data',
      action: () => setSubPage('privacy'),
    },
    {
      id: 'contact' as const,
      label: 'Contact Us',
      icon: Mail,
      description: 'Get in touch with the TeamUp team',
      action: () => setSubPage('contact'),
    },
  ];

  if (subPage !== 'menu') {
    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setSubPage('menu')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </button>

        {subPage === 'blocked-users' && <BlockedUsersSection />}
        {subPage === 'terms' && <TermsSection />}
        {subPage === 'privacy' && <PrivacySection />}
        {subPage === 'contact' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Left - Form */}
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Contact Us</h2>
                <p className="text-muted-foreground">
                  Have a question or feedback? Drop us a message.
                </p>

                <form ref={formRef} onSubmit={sendEmail} className="space-y-4">
                  <Input name="user_name" placeholder="Your Name" required />
                  <Input name="user_email" type="email" placeholder="Your Email" required />
                  <Textarea name="message" placeholder="Your Message" rows={5} required />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={sendingEmail}
                    className="mt-2 w-fit rounded-full bg-orange-500 px-8 text-white disabled:opacity-60"
                  >
                    {sendingEmail ? "Sending..." : "Send Message →"}
                  </Button>
                </form>
              </div>

              {/* Right - Illustration */}
              <div className="relative flex items-center justify-center">
                <div className="absolute right-[-20%] top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-white/10" />
                <img
                  src="/images/landing/team-illustration.avif"
                  alt="Contact TeamUp illustration"
                  className="relative z-10 w-full max-w-[420px] object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }


  return (
    <div className="max-w-2xl mx-auto">
      <div className="card-base p-6 mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-primary/10">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">Settings</h1>
            <p className="text-muted-foreground text-sm">Manage your account and preferences</p>
          </div>
        </div>
      </div>

      <div className="card-base divide-y divide-border">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={item.action}
            className={`w-full flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors text-left ${
              item.danger ? 'text-destructive' : 'text-foreground'
            }`}
          >
            <div className={`p-2 rounded-lg ${item.danger ? 'bg-destructive/10' : 'bg-secondary'}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{item.label}</p>
              <p className={`text-xs ${item.danger ? 'text-destructive/70' : 'text-muted-foreground'}`}>
                {item.description}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

// ===== SUB-SECTIONS =====

const BlockedUsersSection = () => {
  const { user } = useAuth();
  const { blockedByMe, refreshBlocks } = useBlocks();
  const [blockedUserProfiles, setBlockedUserProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  // Load blocked user profiles
  useEffect(() => {
    if (!user || blockedByMe.size === 0) {
      setBlockedUserProfiles([]);
      setLoading(false);
      return;
    }

    const loadProfiles = async () => {
      setLoading(true);
      const profiles = await Promise.all(
        Array.from(blockedByMe).map(userId => getProfile(userId))
      );
      setBlockedUserProfiles(profiles.filter(p => p !== null) as UserProfile[]);
      setLoading(false);
    };

    loadProfiles();
  }, [user, blockedByMe]);

  const handleUnblock = async (userId: string) => {
    if (!user) return;
    setUnblocking(userId);
    
    try {
      await unblockUser(user.uid, userId);
      toast.success('User unblocked successfully');
      refreshBlocks();
    } catch (error: any) {
      console.error('Error unblocking user:', error);
      toast.error(error.message || 'Failed to unblock user');
    }
    
    setUnblocking(null);
  };

  return (
    <div className="card-base p-6">
      <div className="flex items-center gap-3 mb-4">
        <Ban className="w-5 h-5 text-foreground" />
        <h2 className="font-display font-bold text-xl text-foreground">Blocked Users</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Users you have blocked will appear here. You can unblock them at any time.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : blockedUserProfiles.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No blocked users
        </div>
      ) : (
        <div className="space-y-3">
          {blockedUserProfiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <img
                  src={
                    profile.avatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                      profile.fullName || 'User'
                    )}`
                  }
                  alt={profile.fullName}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <p className="font-medium text-foreground">{profile.fullName}</p>
                  <p className="text-xs text-muted-foreground">{profile.primaryRole}</p>
                </div>
              </div>
              <button
                onClick={() => handleUnblock(profile.id)}
                disabled={unblocking === profile.id}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                {unblocking === profile.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Unblocking...
                  </>
                ) : (
                  'Unblock'
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TermsSection = () => (
  <div className="card-base p-6">
    <h2 className="font-display font-bold text-xl text-foreground mb-4">Terms & Conditions</h2>
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">1. Introduction</h3>
        <p>Welcome to <strong>TeamUp</strong>. By creating an account or using our platform, you agree to these Terms & Conditions.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">2. Eligibility</h3>
        <p>You must be at least <strong>13 years old</strong> to use TeamUp. Information provided must be accurate and up to date.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">3. Account Responsibility</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>You are responsible for maintaining account security</li>
          <li>All actions under your account are your responsibility</li>
          <li>Do not share login credentials</li>
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">4. Team Rules</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Only team leaders can invite or remove members</li>
          <li>Team decisions are managed by the leader</li>
          <li>TeamUp is not responsible for internal disputes</li>
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">5. Prohibited Activities</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Impersonation or false information</li>
          <li>Harassment, abuse, or exploitation</li>
          <li>Attempting to bypass platform security</li>
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">6. Termination</h3>
        <p>TeamUp reserves the right to suspend or terminate accounts that violate these terms, with or without notice.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">7. Changes to Terms</h3>
        <p>These terms may be updated. Continued use of TeamUp means acceptance of updated terms.</p>
      </section>
    </div>
  </div>
);

const PrivacySection = () => (
  <div className="card-base p-6">
    <h2 className="font-display font-bold text-xl text-foreground mb-4">Privacy Policy</h2>
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">Privacy Policy – TeamUp</h3>
        <p>Your privacy is important to us. This Privacy Policy explains how TeamUp collects, uses, and protects your information.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">1. Information We Collect</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Full name</li>
          <li>Email address</li>
          <li>Username</li>
          <li>Profile details such as skills, roles, and team activity</li>
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">2. How We Use Your Information</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Create and manage your account</li>
          <li>Enable team collaboration and invitations</li>
          <li>Improve platform functionality and user experience</li>
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">3. Data Visibility</h3>
        <p>Some profile information is visible to other users to support collaboration. Sensitive information such as email and authentication data is never shared publicly.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">4. Data Sharing</h3>
        <p>TeamUp does <strong>not sell or rent</strong> your personal data to third parties.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">5. Data Security</h3>
        <p>We take reasonable technical and organizational measures to protect your data. However, no digital system can guarantee absolute security.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">6. User Control</h3>
        <p>You may update or delete your account information at any time through your profile settings.</p>
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-1">7. Policy Updates</h3>
        <p>This Privacy Policy may be updated periodically. Continued use of TeamUp constitutes acceptance of the updated policy.</p>
      </section>
    </div>
  </div>
);

const ContactSection = () => (
  <div className="card-base p-6">
    <h2 className="font-display font-bold text-xl text-foreground mb-4">Contact Us</h2>
    <div className="space-y-4 text-sm text-muted-foreground">
      <p>Have questions, feedback, or need help? Reach out to us!</p>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-primary" />
          <a href="mailto:support@teamup.com" className="text-primary hover:underline">
            support@teamup.com
          </a>
        </div>
      </div>
      <p className="mt-4">We typically respond within 24–48 hours.</p>
    </div>
  </div>
);

export default SettingsPage;
