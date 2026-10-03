import React from 'react';
import { NavLink } from 'react-router-dom';
import { Mic, MessageSquare, Brain, Settings } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Voice', icon: Mic },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/memories', label: 'Memories', icon: Brain },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const MobileBottomNav: React.FC = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d12]/95 backdrop-blur-lg border-t border-gray-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive
                  ? 'text-orange-400 font-bold bg-orange-500/10 border border-orange-500/20'
                  : 'text-gray-400 hover:text-gray-200'
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
