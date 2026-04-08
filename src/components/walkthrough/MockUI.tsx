import React from 'react';
import { motion } from 'framer-motion';
import { Search, Users, ExternalLink, ShieldCheck, CheckCircle2, Video, Calendar, Plus, FolderKanban, Activity, Star } from 'lucide-react';

interface MockUIProps {
  mockId: string;
}

export const MockUI: React.FC<MockUIProps> = ({ mockId }) => {
  const containerVariants: any = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.1 } 
    },
    exit: { opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.4 } }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  switch (mockId) {
    case 'mock-discover':
      return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="bg-white dark:bg-[#0B1120] border border-[#1E293B] shadow-2xl rounded-2xl p-6 w-[400px] max-w-full z-50">
          <motion.div variants={itemVariants} className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-xl text-[#0F172A] dark:text-white">Discover</h3>
            <div className="bg-[#E2E8F0] dark:bg-[#1E293B] p-2 rounded-full cursor-pointer hover:bg-[#CBD5E1]">
              <Search className="w-4 h-4 text-[#475569] dark:text-[#94A3B8]" />
            </div>
          </motion.div>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <motion.div key={i} variants={itemVariants} className="bg-[#F8FAFC] dark:bg-[#1E293B]/50 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] hover:border-[#0D9488] transition-colors relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-[#FBBF24]/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                <div className="flex gap-3 items-center mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0F172A] flex items-center justify-center text-white font-bold opacity-90">
                    T{i}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-[#0F172A] dark:text-white">Nexus Frontend Rebuild</h4>
                    <p className="text-xs text-[#64748B]">Looking for React Devs</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-[#14B8A6]/10 text-[#0D9488] rounded-md">React</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-[#3B82F6]/10 text-[#2563EB] rounded-md">TypeScript</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      );

    case 'mock-team-profile':
      return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="bg-white dark:bg-[#0B1120] border border-[#1E293B] shadow-2xl rounded-2xl w-[450px] max-w-full overflow-hidden z-50">
          <div className="h-24 bg-gradient-to-r from-[#0F172A] to-[#1E293B] relative">
            <div className="absolute -bottom-6 left-6 w-16 h-16 bg-white dark:bg-[#0F172A] rounded-xl border-4 border-white dark:border-[#0F172A] shadow-md flex items-center justify-center font-bold text-2xl text-[#14B8A6]">
              NX
            </div>
            <div className="absolute top-4 right-4 bg-[#FBBF24] text-[#0F172A] text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" /> Top 5%
            </div>
          </div>
          <div className="p-6 pt-10">
            <motion.h3 variants={itemVariants} className="font-bold text-2xl text-[#0F172A] dark:text-white mb-1">Nexus Protocol</motion.h3>
            <motion.p variants={itemVariants} className="text-sm text-[#64748B] mb-6">Building the next-gen decentralized messaging platform.</motion.p>
            
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
              <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-4">
                <Users className="w-5 h-5 text-[#3B82F6] mb-2" />
                <div className="font-bold text-lg dark:text-white">12 Members</div>
                <div className="text-xs text-[#64748B]">Active contributors</div>
              </div>
              <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-4">
                <ExternalLink className="w-5 h-5 text-[#14B8A6] mb-2" />
                <div className="font-bold text-lg dark:text-white">3 Open Roles</div>
                <div className="text-xs text-[#64748B]">Hiring UI/UX, Backend</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      );

    case 'mock-skill-verification':
      return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="bg-white dark:bg-[#0B1120] border border-[#1E293B] shadow-2xl rounded-2xl p-6 w-[400px] max-w-full z-50 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#14B8A6]/10 rounded-bl-full -mr-10 -mt-10 blur-xl" />
          <motion.div variants={itemVariants} className="w-16 h-16 bg-[#14B8A6]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#14B8A6]/30">
            <ShieldCheck className="w-8 h-8 text-[#0D9488]" />
          </motion.div>
          <motion.h3 variants={itemVariants} className="font-bold text-xl text-[#0F172A] dark:text-white mb-2">React Knowledge Test</motion.h3>
          <motion.p variants={itemVariants} className="text-sm text-[#64748B] mb-6 inline-block w-4/5">Prove your skills and earn a verified badge to stand out to 20x more teams.</motion.p>
          
          <motion.div variants={itemVariants} className="bg-[#F8FAFC] dark:bg-[#1E293B]/50 rounded-xl p-4 mb-6 text-left border border-[#E2E8F0] dark:border-[#334155]">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-4 h-4 text-[#14B8A6]" />
              <span className="text-sm font-medium dark:text-gray-300">15 Multiple Choice Questions</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-[#14B8A6]" />
              <span className="text-sm font-medium dark:text-gray-300">20 Minutes Time Limit</span>
            </div>
          </motion.div>
          
          <motion.button variants={itemVariants} className="w-full bg-[#0F172A] hover:bg-[#1E293B] dark:bg-[#14B8A6] dark:hover:bg-[#0D9488] text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl">
            Start Verification
          </motion.button>
        </motion.div>
      );

    case 'mock-interviews':
      return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="bg-white dark:bg-[#0B1120] border border-[#1E293B] shadow-2xl rounded-2xl p-6 w-[450px] max-w-full z-50">
          <motion.div variants={itemVariants} className="flex gap-4 items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#3B82F6]/20 flex items-center justify-center">
              <Video className="w-6 h-6 text-[#2563EB]" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-[#0F172A] dark:text-white">Interviews</h3>
              <p className="text-xs text-[#64748B]">Upcoming scheduled calls</p>
            </div>
          </motion.div>
          
          <motion.div variants={itemVariants} className="bg-[#F8FAFC] dark:bg-[#1E293B]/50 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] border-l-4 border-l-[#FBBF24] mb-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-sm text-[#0F172A] dark:text-white">Frontend Dev Role</h4>
              <span className="text-[10px] font-bold px-2 py-1 bg-[#FBBF24]/20 text-[#D97706] rounded-full">In 2 Hours</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-4">
              <Calendar className="w-3 h-3" /> Today, 2:00 PM EST
            </div>
            <div className="flex gap-2">
              <button className="flex-1 bg-[#0F172A] text-white py-2 rounded-lg text-xs font-bold dark:bg-white dark:text-[#0F172A]">Join Call</button>
              <button className="flex-1 bg-transparent border border-[#CBD5E1] dark:border-[#475569] py-2 rounded-lg text-xs font-bold dark:text-white">Reschedule</button>
            </div>
          </motion.div>
        </motion.div>
      );

    case 'mock-create-team':
      return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="bg-white dark:bg-[#0B1120] border border-[#1E293B] shadow-2xl rounded-2xl p-6 w-[400px] max-w-full z-50">
           <motion.div variants={itemVariants} className="flex gap-3 items-center mb-6">
            <div className="w-10 h-10 rounded-full bg-[#14B8A6]/20 flex items-center justify-center">
              <Plus className="w-5 h-5 text-[#0D9488]" />
            </div>
            <h3 className="font-bold text-xl text-[#0F172A] dark:text-white">Build a Team</h3>
          </motion.div>
          
          <div className="space-y-4">
            <motion.div variants={itemVariants}>
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1">Team Name</label>
              <div className="w-full h-10 bg-[#F1F5F9] dark:bg-[#1E293B]/50 rounded-lg border border-[#E2E8F0] dark:border-[#334155] px-3 flex items-center text-sm dark:text-white">
                Project Alpha
              </div>
            </motion.div>
            <motion.div variants={itemVariants}>
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1">Need Roles</label>
              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-1 bg-[#1E293B] text-white text-xs rounded-md">Full Stack</span>
                <span className="px-3 py-1 bg-[#1E293B] text-white text-xs rounded-md">Designer</span>
                <span className="px-3 py-1 border border-dashed border-[#94A3B8] text-[#64748B] text-xs rounded-md cursor-pointer hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]">+ Add Role</span>
              </div>
            </motion.div>
            <motion.button variants={itemVariants} className="w-full mt-2 bg-[#14B8A6] text-white font-bold py-3 rounded-xl shadow-md hover:-translate-y-0.5 transition-transform">
              Launch Team
            </motion.button>
          </div>
        </motion.div>
      );

    case 'mock-team-management':
      return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="bg-white dark:bg-[#0B1120] border border-[#1E293B] shadow-2xl rounded-2xl w-[450px] max-w-full overflow-hidden z-50">
          <div className="bg-[#0F172A] p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <FolderKanban className="w-5 h-5 text-[#14B8A6]" />
              <h3 className="font-bold text-white">Workspace</h3>
            </div>
            <div className="flex -space-x-2">
              {[1,2,3].map(i => (
                <div key={i} className="w-6 h-6 rounded-full border-2 border-[#0F172A] bg-[#3B82F6] opacity-80" />
              ))}
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <motion.div variants={itemVariants} className="bg-[#F8FAFC] dark:bg-[#1E293B]/50 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
              <Activity className="w-5 h-5 text-[#3B82F6] mb-2" />
              <div className="text-xs text-[#64748B] uppercase font-bold tracking-wider mb-1">Sprint Progress</div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold dark:text-white leading-none">68%</span>
              </div>
              <div className="w-full h-1.5 bg-[#E2E8F0] dark:bg-[#0F172A] rounded-full mt-3 overflow-hidden">
                <div className="w-[68%] h-full bg-[#14B8A6] rounded-full" />
              </div>
            </motion.div>
            
            <motion.div variants={itemVariants} className="bg-[#F8FAFC] dark:bg-[#1E293B]/50 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
               <div className="text-xs text-[#64748B] uppercase font-bold tracking-wider mb-2">Active Tasks</div>
               <div className="space-y-2">
                 <div className="text-xs flex items-center gap-2 dark:text-gray-300"><div className="w-2 h-2 rounded-full bg-[#14B8A6]" /> API Design</div>
                 <div className="text-xs flex items-center gap-2 dark:text-gray-300"><div className="w-2 h-2 rounded-full bg-[#FBBF24]" /> Hero Banner</div>
               </div>
            </motion.div>
          </div>
        </motion.div>
      );
      
    default:
      return null;
  }
};
