import React, { useState, useEffect, useMemo } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, Tooltip as RechartsTooltip 
} from 'recharts';
import { Team, UserProfile } from '@/types/firestore.types';
import { getProfile } from '@/services/firestore';
import { Sparkles, Users, Target, Zap, ChevronDown, Rocket, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TeamSynergySectionProps {
  discoveredUser: UserProfile;
  leaderTeams: Team[];
}

const PROFICIENCY_MAP = {
  'Beginner': 33,
  'Intermediate': 66,
  'Pro': 100
};

export function TeamSynergySection({ discoveredUser, leaderTeams }: TeamSynergySectionProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(leaderTeams?.[0]?.id || '');
  const [teamMemberProfiles, setTeamMemberProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  console.log('[TeamSynergy] Rendered with teams:', leaderTeams?.length || 0);

  const selectedTeam = useMemo(() => 
    leaderTeams?.find(t => t.id === selectedTeamId), 
    [leaderTeams, selectedTeamId]
  );

  useEffect(() => {
    if (!selectedTeam) return;

    const fetchProfiles = async () => {
      setIsLoading(true);
      try {
        const profiles = await Promise.all(
          selectedTeam.members.map(m => getProfile(m.userId))
        );
        setTeamMemberProfiles(profiles.filter((p): p is UserProfile => p !== null));
      } catch (error) {
        console.error('Error fetching team member profiles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfiles();
  }, [selectedTeam]);

  const synergyData = useMemo(() => {
    if (!selectedTeam || teamMemberProfiles.length === 0) return [];

    // Aggregate all skills from the team and the discovered user
    const allSkillNames = new Set<string>();
    teamMemberProfiles.forEach(p => p.skills?.forEach(s => allSkillNames.add(s.name)));
    discoveredUser.skills?.forEach(s => allSkillNames.add(s.name));

    // To prevent a huge radar chart, we'll pick the top 6 most relevant skills
    // Priority: Skills the discovered user has, then team skills
    const candidateSkillNames = discoveredUser.skills?.map(s => s.name) || [];
    const topSkills = Array.from(allSkillNames)
      .sort((a, b) => {
        const aInCandidate = candidateSkillNames.includes(a);
        const bInCandidate = candidateSkillNames.includes(b);
        if (aInCandidate && !bInCandidate) return -1;
        if (!aInCandidate && bInCandidate) return 1;
        return 0;
      })
      .slice(0, 6);

    return topSkills.map(skill => {
      const teamProficiencies = teamMemberProfiles
        .map(p => p.skills?.find(s => s.name === skill))
        .filter(Boolean)
        .map(s => PROFICIENCY_MAP[s!.proficiency || 'Beginner']);
      
      const teamAvg = teamProficiencies.length > 0 
        ? teamProficiencies.reduce((a, b) => a + b, 0) / teamProficiencies.length 
        : 0;

      const candidateSkill = discoveredUser.skills?.find(s => s.name === skill);
      const candidateVal = candidateSkill ? PROFICIENCY_MAP[candidateSkill.proficiency || 'Beginner'] : 0;

      return {
        subject: skill,
        Team: Math.round(teamAvg),
        Candidate: candidateVal,
        fullMark: 100,
      };
    });
  }, [selectedTeam, teamMemberProfiles, discoveredUser]);

  const synergyInsights = useMemo(() => {
    if (teamMemberProfiles.length === 0) return null;

    const teamSkills = new Set(teamMemberProfiles.flatMap(p => p.skills?.map(s => s.name) || []));
    const userSkills = discoveredUser.skills || [];
    const uniqueSkills = userSkills.filter(s => !teamSkills.has(s.name));
    const strengtheningSkills = userSkills.filter(s => teamSkills.has(s.name));

    let persona = "The Technical Ally";
    let icon = <Zap className="text-white" size={24} />;
    
    if (uniqueSkills.length >= 2) {
      persona = "The Capability Expander";
      icon = <Rocket className="text-white" size={24} />;
    } else if (strengtheningSkills.length >= 3) {
      persona = "The Core Powerhouse";
      icon = <ShieldCheck className="text-white" size={24} />;
    } else if (discoveredUser.primaryRole?.includes('Manager') || discoveredUser.primaryRole?.includes('Lead')) {
      persona = "The Strategic Pillar";
      icon = <Target className="text-white" size={24} />;
    }

    return {
      persona,
      icon,
      uniqueCount: uniqueSkills.length,
      strengthenCount: strengtheningSkills.length,
      topGapFiller: uniqueSkills[0]?.name || (userSkills.length > 0 ? userSkills[0].name : null)
    };
  }, [discoveredUser, teamMemberProfiles]);

  // Don't return null if teams are still loading but we know the user IS a leader
  if (!leaderTeams || leaderTeams.length === 0) {
    if (isLoading) {
      // Fallback UI or loading state if needed, but for now we'll just wait for teams
    }
  }

  return (
    <div className="mt-6 mb-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/40 border border-teal-100 hover:bg-white/60 transition-all group"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-teal-500 text-white shadow-lg shadow-teal-500/20 group-hover:scale-110 transition-transform">
            <Sparkles size={18} />
          </div>
          <div className="text-left">
            <h4 className="font-black text-slate-800 text-sm leading-none">Synergy Simulator</h4>
            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mt-1">AI-Powered Fit Analysis</p>
          </div>
        </div>
        <ChevronDown 
          size={20} 
          className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-4">
              {leaderTeams.length > 1 && (
                <div className="flex items-center justify-between gap-3 px-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Team</span>
                  <select 
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="bg-white/80 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    {leaderTeams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div 
                className="relative rounded-2xl p-4 bg-white/60 border border-white/80 shadow-sm"
                style={{ height: 300 }}
              >
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                  </div>
                ) : (
                  <>
                    <div className="absolute top-4 left-4 z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Current Team</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{discoveredUser.fullName}</span>
                      </div>
                    </div>
                    
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={synergyData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: '700' }} />
                        <Radar
                          name="Team"
                          dataKey="Team"
                          stroke="#0d9488"
                          fill="#0d9488"
                          fillOpacity={0.4}
                        />
                        <Radar
                          name="Candidate"
                          dataKey="Candidate"
                          stroke="#8b5cf6"
                          fill="#8b5cf6"
                          fillOpacity={0.4}
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            fontSize: '12px',
                            fontWeight: '700'
                          }} 
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>

              {synergyInsights && !isLoading && (
                <div className="space-y-4">
                  {/* Consolidated Synergy Insights Card */}
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="rounded-[2rem] p-6 bg-teal-600 text-white shadow-xl shadow-teal-900/20 relative overflow-hidden"
                  >
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-400/10 rounded-full -ml-12 -mb-12 blur-xl" />

                    <div className="relative z-10">
                      {/* Persona Header */}
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-2xl bg-teal-500 shadow-inner">
                          {React.cloneElement(synergyInsights.icon as React.ReactElement, { size: 24, className: 'text-white' })}
                        </div>
                        <div>
                          <h5 className="font-black text-xl leading-tight">{synergyInsights.persona}</h5>
                          <p className="text-[10px] font-black text-teal-200 uppercase tracking-[0.2em] mt-0.5">Projected Role</p>
                        </div>
                      </div>

                      {/* Synergy Metrics Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                          <div className="text-3xl font-black mb-1">{synergyInsights.uniqueCount}</div>
                          <div className="text-[10px] font-bold text-teal-100 uppercase tracking-wider">New Capabilities</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                          <div className="text-3xl font-black mb-1">{synergyInsights.strengthenCount}</div>
                          <div className="text-[10px] font-bold text-teal-100 uppercase tracking-wider">Skills Reinforced</div>
                        </div>
                      </div>

                      {/* Gap Filler Pill */}
                      {synergyInsights.topGapFiller && (
                        <div className="inline-flex items-center gap-2 bg-teal-800/40 backdrop-blur-sm px-4 py-2.5 rounded-full border border-white/5 text-xs font-bold text-teal-50">
                          <Target size={14} className="text-teal-300" />
                          <span>Fills the critical gap in <span className="text-white">{synergyInsights.topGapFiller}</span></span>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Quick Guide */}
                  <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100/50">
                    <h6 className="text-[10px] font-black text-teal-800 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Zap size={10} /> Quick Guide
                    </h6>
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-slate-600">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-teal-500 mt-0.5 shrink-0" />
                        <p>Teal area shows your current team's average power.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 mt-0.5 shrink-0" />
                        <p>Purple area shows where this person adds value.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
