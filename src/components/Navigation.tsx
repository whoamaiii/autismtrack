import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, LayoutDashboard, PlusCircle, LineChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const Navigation: React.FC = () => {
    const { t } = useTranslation();

    return (
        <nav className="fixed bottom-0 left-0 right-0 glass dark:glass-dark z-50 pb-safe">
            <div className="flex justify-around items-center h-20 max-w-md mx-auto px-4">
                <NavLink to="/" className="relative group">
                    {({ isActive }) => (
                        <div className={`flex flex-col items-center gap-1 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                            <Home size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-semibold tracking-wide">{t('navigation.home')}</span>
                            {isActive && (
                                <motion.div
                                    layoutId="nav-indicator"
                                    className="absolute -top-2 w-1 h-1 bg-primary rounded-full"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                        </div>
                    )}
                </NavLink>

                <NavLink to="/dashboard" className="relative group">
                    {({ isActive }) => (
                        <div className={`flex flex-col items-center gap-1 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                            <LayoutDashboard size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-semibold tracking-wide">{t('navigation.dashboard')}</span>
                            {isActive && (
                                <motion.div
                                    layoutId="nav-indicator"
                                    className="absolute -top-2 w-1 h-1 bg-primary rounded-full"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                        </div>
                    )}
                </NavLink>

                <NavLink to="/log" className="relative group">
                    {({ isActive }) => (
                        <div className={`flex flex-col items-center gap-1 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                            <div className={`p-3 rounded-full transition-all duration-300 ${isActive ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-300 dark:border dark:border-white/10'}`}>
                                <PlusCircle size={28} strokeWidth={2.5} />
                            </div>
                        </div>
                    )}
                </NavLink>

                <NavLink to="/analysis" className="relative group">
                    {({ isActive }) => (
                        <div className={`flex flex-col items-center gap-1 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                            <LineChart size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-semibold tracking-wide">{t('navigation.analysis')}</span>
                            {isActive && (
                                <motion.div
                                    layoutId="nav-indicator"
                                    className="absolute -top-2 w-1 h-1 bg-primary rounded-full"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                        </div>
                    )}
                </NavLink>
            </div>
        </nav>
    );
};
