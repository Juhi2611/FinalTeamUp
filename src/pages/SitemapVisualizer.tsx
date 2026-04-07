import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Search, Users, CheckCircle, 
  Calendar, UserPlus, FileEdit, User, Bell, 
  BarChart, Map, Award, Star, Clock, Filter, 
  Briefcase, MessageSquare, Play, Pause
} from 'lucide-react';

const steps = [
  { 
    id: 'home', 
    title: 'Dashboard', 
    icon: LayoutDashboard, 
    desc: 'Entry point with overview showing quick stats.',
    pos: { top: '15%', left: '15%' }
  },
  { 
    id: 'discover', 
    title: 'Discover Teams', 
    icon: Search, 
    desc: 'Find teams, filter by skills and domain.',
    pos: { top: '15%', left: '50%' }
  },
  { 
    id: 'team-profile', 
    title: 'Team Profile', 
    icon: Users, 
    desc: 'View members, skills, and achievements.',
    pos: { top: '15%', left: '85%' }
  },
  { 
    id: 'verify', 
    title: 'Skill Verification', 
    icon: CheckCircle, 
    desc: 'Test interface with progress flow.',
    pos: { top: '50%', left: '85%' }
  },
  { 
    id: 'interviews', 
    title: 'Interviews', 
    icon: Calendar, 
    desc: 'Schedule and live interaction simulation.',
    pos: { top: '50%', left: '50%' }
  },
  { 
    id: 'join', 
    title: 'Create / Join Team', 
    icon: UserPlus, 
    desc: 'Form filling and role selection.',
    pos: { top: '50%', left: '15%' }
  },
  { 
    id: 'manage', 
    title: 'Team Management', 
    icon: FileEdit, 
    desc: 'Task assignment and tracking charts.',
    pos: { top: '85%', left: '15%' }
  },
  { 
    id: 'profile', 
    title: 'User Profile', 
    icon: User, 
    desc: 'Verification badges and personal stats.',
    pos: { top: '85%', left: '50%' }
  },
  { 
    id: 'notifications', 
    title: 'Activity Feed', 
    icon: Bell, 
    desc: 'Real-time popups and activity.',
    pos: { top: '85%', left: '85%' }
  },
];

// Reusable animated mini-UI components
const DashboardUI = () => (
  <div className="grid gap-2 p-2">
    <div className="grid grid-cols-3 gap-2">
      {[1, 2, 3].map(i => (
        <motion.div 
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.1 }}
          className="h-8 bg-teal-500/20 rounded border border-teal-500/30 flex items-center justify-center"
        >
          <BarChart className="w-4 h-4 text-teal-400" />
        </motion.div>
      ))}
    </div>
    <motion.div 
      initial={{ y: 10, opacity: 0 }} 
      animate={{ y: 0, opacity: 1 }} 
      transition={{ delay: 0.4 }}
      className="h-16 bg-white/5 rounded"
    />
  </div>
);

const DiscoverUI = () => (
  <div className="flex flex-col gap-2 p-2">
    <motion.div className="h-6 w-full bg-white/5 rounded flex items-center px-2"
       initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
       <Search className="w-3 h-3 text-white/50 mr-2" />
       <div className="h-2 w-16 bg-white/20 rounded" />
    </motion.div>
    <div className="flex gap-2">
      <Filter className="w-4 h-4 text-yellow-400" />
      <div className="h-4 w-12 bg-yellow-400/20 rounded" />
    </div>
    <div className="grid grid-cols-2 gap-2 mt-1">
       {[1, 2].map(i => (
         <motion.div key={i}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.2 }}
            className="h-12 bg-white/10 rounded" />
       ))}
    </div>
  </div>
);

const TeamProfileUI = () => (
  <div className="p-2 flex flex-col items-center gap-2">
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-12 h-12 rounded-full bg-teal-500/30 border-2 border-teal-400 flex items-center justify-center">
      <Users className="w-6 h-6 text-teal-400" />
    </motion.div>
    <div className="flex gap-1 justify-center w-full">
      {[1, 2, 3].map(i => (
        <motion.div key={i} initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }} className="w-6 h-6 rounded-full bg-white/20" />
      ))}
    </div>
    <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} className="h-4 bg-yellow-400/20 rounded mt-1" />
  </div>
);

const VerifyUI = () => (
  <div className="flex flex-col gap-3 p-2">
    <div className="flex justify-between items-center w-full">
      <div className="h-2 w-8 bg-white/20 rounded" />
      <Clock className="w-3 h-3 text-teal-400" />
    </div>
    <motion.div initial={{ width: 0 }} animate={{ width: '70%' }} transition={{ duration: 1 }} className="h-2 bg-teal-400 rounded-full" />
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex flex-col gap-2 mt-2">
      <div className="h-4 w-full bg-white/10 rounded flex items-center px-1"><div className="w-2 h-2 rounded-full border border-teal-400" /></div>
      <div className="h-4 w-full bg-white/10 rounded flex items-center px-1"><div className="w-2 h-2 rounded-full bg-teal-400" /></div>
    </motion.div>
  </div>
);

const InterviewsUI = () => (
  <div className="p-2 flex flex-col gap-2 h-full">
    <motion.div initial={{ rotateX: 90 }} animate={{ rotateX: 0 }} className="h-10 w-full bg-white/5 rounded border border-white/10 flex items-center justify-between px-2">
      <Calendar className="w-4 h-4 text-teal-400" />
      <div className="w-12 h-2 bg-teal-400/50 rounded" />
    </motion.div>
    <div className="flex-1 flex items-center gap-2">
      <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="w-8 h-8 rounded-full bg-teal-500/20" />
      <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2, delay: 0.5 }} className="w-8 h-8 rounded-full bg-yellow-500/20" />
    </div>
  </div>
);

const JoinFormUI = () => (
  <div className="flex flex-col gap-2 p-2">
    {[1, 2, 3].map(i => (
      <motion.div key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }} className="h-4 w-full bg-white/10 rounded" />
    ))}
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-2 h-6 w-full bg-teal-500 rounded text-[10px] flex items-center justify-center font-bold text-[#0a192f]">SUBMIT</motion.div>
  </div>
);

const ManagementUI = () => (
  <div className="p-2 flex gap-2 h-full">
    <div className="w-1/3 flex flex-col gap-1">
      {[1, 2].map(i => <motion.div key={i} initial={{ height: 0 }} animate={{ height: 'auto' }} className="h-8 bg-white/5 rounded px-1 flex flex-col gap-1 justify-center"><div className="w-4 h-1 bg-white/20" /><div className="w-8 h-1 bg-teal-400/50" /></motion.div>)}
    </div>
    <div className="flex-1 bg-white/5 rounded flex items-end p-1 gap-1">
      {[40, 70, 50, 90, 60].map((h, i) => (
        <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.5, delay: i * 0.1 }} className="flex-1 bg-yellow-400 rounded-t-sm" />
      ))}
    </div>
  </div>
);

const UserProfileUI = () => (
  <div className="p-2 flex flex-col gap-2 items-center">
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-10 h-10 rounded-full bg-teal-400/20 border-2 border-teal-400" />
    <div className="flex gap-2">
      {[Star, Award, Briefcase].map((Icon, i) => (
         <motion.div key={i} initial={{ rotate: -180, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }} className="w-6 h-6 rounded-full bg-yellow-400/20 flex items-center justify-center">
           <Icon className="w-3 h-3 text-yellow-400" />
         </motion.div>
      ))}
    </div>
    <motion.div initial={{ width: 0 }} animate={{ width: '80%' }} className="h-1 bg-white/20 rounded mt-1" />
  </div>
);

const ActivityUI = () => (
  <div className="p-2 flex flex-col gap-2 overflow-hidden h-full">
    <AnimatePresence>
      {[1, 2, 3].map(i => (
        <motion.div 
          key={i} 
          initial={{ x: 20, opacity: 0 }} 
          animate={{ x: 0, opacity: 1 }} 
          transition={{ delay: i * 0.3 }}
          className="bg-white/10 p-1.5 rounded flex gap-2 items-center"
        >
          <div className="w-4 h-4 rounded-full bg-teal-400/30" />
          <div className="h-2 w-16 bg-white/30 rounded" />
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

const MiniUIComponents = [
  DashboardUI, DiscoverUI, TeamProfileUI, VerifyUI, InterviewsUI, JoinFormUI, ManagementUI, UserProfileUI, ActivityUI
];


export default function SitemapVisualizer() {
  const [activeStep, setActiveStep] = useState(0);
  const [isAutoplay, setIsAutoplay] = useState(true);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoplay && !isHovering) {
      interval = setInterval(() => {
        setActiveStep((prev) => (prev + 1) % steps.length);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isAutoplay, isHovering]);

  const handleNodeInteraction = (index: number) => {
    setActiveStep(index);
    setIsAutoplay(false); // Pause autoplay if user manually clicks
  };

  // SVG connecting paths mapping
  const renderPath = (index: number) => {
    if (index === steps.length - 1) return null;
    
    // Draw paths explicitly between nodes based on grid. 
    // Converting percentages to grid coords:
    // Node 0(0,0)->1(1,0)->2(2,0)
    // Node 5(0,1)<-4(1,1)<-3(2,1)
    // Node 6(0,2)->7(1,2)->8(2,2)
    const points = [
      "M 15 15 L 50 15", "M 50 15 L 85 15", "M 85 15 C 85 30, 85 50, 85 50", // 0->1, 1->2, 2->3
      "M 85 50 L 50 50", "M 50 50 L 15 50", "M 15 50 C 15 70, 15 85, 15 85", // 3->4, 4->5, 5->6
      "M 15 85 L 50 85", "M 50 85 L 85 85" // 6->7, 7->8
    ];

    const d = points[index];
    const pathIsActive = index < activeStep;
    const pathIsCurrent = index === activeStep - 1;

    return (
      <svg key={`path-${index}`} className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#008080" />
            <stop offset="100%" stopColor="#FFDB58" />
          </linearGradient>
        </defs>
        
        {/* Background track line */}
        <motion.path 
          d={d}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="scale-paths"
        />

        {/* Animated active path */}
        <motion.path 
          d={d}
          fill="none"
          stroke={pathIsActive || pathIsCurrent ? `url(#grad-${index})` : "none"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ 
            pathLength: pathIsActive || pathIsCurrent ? 1 : 0,
            opacity: pathIsActive || pathIsCurrent ? 1 : 0
          }}
          transition={{ duration: 1, ease: "easeInOut" }}
          vectorEffect="non-scaling-stroke"
          className="scale-paths glow-path"
        />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a192f] text-white flex flex-col font-sans overflow-hidden pattern-bg">
      {/* Header */}
      <div className="p-8 pb-4 flex justify-between items-end relative z-20">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-yellow-400 tracking-tight"
          >
            TeamUp Platform Flow
          </motion.h1>
          <p className="text-teal-100/60 mt-2 text-lg max-w-xl">
            Interactive sitemap and product demo. Follow the user journey from discovery to team management.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={() => setIsAutoplay(!isAutoplay)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors"
          >
            {isAutoplay ? <Pause className="w-4 h-4 text-teal-400" /> : <Play className="w-4 h-4 text-teal-400" />}
            <span className="text-sm font-medium">{isAutoplay ? 'Pause Tour' : 'Resume Tour'}</span>
          </button>
        </div>
      </div>

      <style>{`
        .scale-paths {
           transform-origin: top left;
        }
        .glow-path {
           filter: drop-shadow(0 0 6px rgba(45, 212, 191, 0.6));
        }
        .pattern-bg {
           background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
           background-size: 40px 40px;
        }
      `}</style>

      {/* Main Canvas */}
      <div 
        className="flex-1 relative m-8 mt-4 rounded-3xl border border-white/10 bg-[#061121]/80 backdrop-blur-3xl overflow-hidden shadow-2xl"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        
        {/* Render connections */}
        <div className="absolute inset-0 z-0">
          <svg viewBox="0 0 100 100" className="w-full h-full preserve-3d" preserveAspectRatio="none">
            {steps.map((_, i) => {
              if (i === steps.length - 1) return null;
              
              // Coordinates
              const xPos = [15, 50, 85, 85, 50, 15, 15, 50, 85];
              const yPos = [15, 15, 15, 50, 50, 50, 85, 85, 85];
              
              const x1 = xPos[i];
              const y1 = yPos[i];
              const x2 = xPos[i+1];
              const y2 = yPos[i+1];

              let pathData = `M ${x1} ${y1} L ${x2} ${y2}`;
              if (x1 === x2 && y1 !== y2) {
                 // vertical curve
                 pathData = `M ${x1} ${y1} C ${x1} ${y1 + 15}, ${x2} ${y2 - 15}, ${x2} ${y2}`;
              }

              const isPassed = i < activeStep;
              const isCurrent = i === activeStep - 1;

              return (
                <g key={i}>
                  <path 
                    d={pathData} 
                    fill="none" 
                    stroke="rgba(255,255,255,0.05)" 
                    strokeWidth="0.5" 
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray="2 2"
                  />
                  <motion.path 
                    d={pathData} 
                    fill="none" 
                    stroke={isPassed || isCurrent ? "rgba(45, 212, 191, 0.8)" : "none"} 
                    strokeWidth="0.8" 
                    vectorEffect="non-scaling-stroke"
                    className="glow-path"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: isPassed || isCurrent ? 1 : 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                  />
                </g>
              )
            })}
          </svg>
        </div>

        {/* Render Nodes */}
        {steps.map((step, index) => {
          const isActive = index === activeStep;
          const isPassed = index < activeStep;
          const Icon = step.icon;
          const MiniUI = MiniUIComponents[index];

          return (
            <motion.div
              key={step.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex flex-col items-center group"
              style={{ top: step.pos.top, left: step.pos.left }}
              onClick={() => handleNodeInteraction(index)}
              whileHover={{ scale: 1.05 }}
            >
              <motion.div 
                className={`relative w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-500
                  ${isActive 
                    ? 'bg-teal-500/20 border-teal-400 shadow-[0_0_30px_rgba(45,212,191,0.5)] scale-110' 
                    : isPassed 
                      ? 'bg-[#0a192f] border-teal-500/50 grayscale-[50%]' 
                      : 'bg-[#0a192f] border-white/10 grayscale opacity-60'}
                `}
                animate={isActive ? { y: [0, -5, 0] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {/* Ping animation for active step */}
                {isActive && (
                  <motion.div 
                    className="absolute inset-0 rounded-2xl border-2 border-teal-400"
                    animate={{ scale: [1, 1.4], opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                  />
                )}
                <Icon className={`w-7 h-7 ${isActive ? 'text-teal-400' : isPassed ? 'text-teal-200' : 'text-white/40'}`} />
              </motion.div>

              {/* Title label */}
              <div className="mt-3 text-center pointer-events-none">
                <p className={`font-semibold text-sm whitespace-nowrap transition-colors duration-500 ${isActive ? 'text-teal-300' : 'text-white/70'}`}>
                  {step.title}
                </p>
              </div>

              {/* Detail Popover / Mini UI container */}
              <AnimatePresence>
                {(isActive || (isHovering && !isAutoplay && index === activeStep)) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                    className="absolute top-24 w-64 bg-[#0a192f]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 pointer-events-auto"
                    style={{ zIndex: 50 }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="bg-yellow-400/20 p-2 rounded-lg text-yellow-400">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-white leading-tight">{step.title}</h3>
                        <p className="text-xs text-white/50 mt-1 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                    
                    {/* The specific Mini UI demo area */}
                    <div className="h-32 bg-[#061121] rounded-lg border border-white/5 overflow-hidden">
                      <MiniUI />
                    </div>
                    
                    {/* Step indicator in popover */}
                    <div className="mt-4 flex gap-1 justify-center">
                      {steps.map((_, dotIdx) => (
                        <div 
                          key={dotIdx} 
                          className={`h-1 rounded-full transition-all duration-300 ${dotIdx === index ? 'w-4 bg-teal-400' : 'w-1 bg-white/20'}`} 
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      
      {/* Footer Info */}
      <div className="px-8 pb-4 flex justify-between items-center text-xs text-white/40 z-20">
        <p>Hover over the diagram to explore freely.</p>
        <p>Step {activeStep + 1} of {steps.length}</p>
      </div>
    </div>
  );
}
