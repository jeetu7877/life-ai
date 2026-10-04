import React from 'react';
import { NavLink } from 'react-router-dom';
import { Mic, MessageSquare, Target, Brain, Settings } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Home', icon: Mic },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/memories', label: 'Memories', icon: Brain },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const MobileBottomNav: React.FC = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0F18]/95 backdrop-blur-xl border-t border-[#202B3D] px-3 py-2 flex items-center justify-around shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1.5 px-3.5 rounded-xl transition-all ${
                isActive
                  ? 'text-white font-semibold bg-gradient-to-r from-[#00A8FF]/20 to-[#8B5CF6]/20 border border-[#00D9FF]/40 shadow-[0_0_12px_rgba(0,217,255,0.25)]'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
