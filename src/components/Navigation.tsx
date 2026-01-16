import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, BarChart3, PlusCircle, TrendingUp, type LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

// Navigation items configuration
interface NavItem {
    path: string;
    icon: LucideIcon;
    labelKey: string;
    isCenter?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { path: '/', icon: Home, labelKey: 'navigation.home' },
    { path: '/dashboard', icon: BarChart3, labelKey: 'navigation.stats' },
    { path: '/log', icon: PlusCircle, labelKey: 'navigation.log', isCenter: true },
    { path: '/analysis', icon: TrendingUp, labelKey: 'navigation.trends' },
];

export const Navigation: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();

    return (
        <nav className="fixed bottom-0 left-0 right-0 glass dark:glass-dark z-50 pb-safe" role="navigation" aria-label="Main navigation">
            <div className="flex justify-around items-center h-20 max-w-md mx-auto px-2">
                {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    // Center item (Log) has special styling
                    if (item.isCenter) {
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className="relative flex flex-col items-center justify-center min-w-[56px] min-h-[56px]"
                                aria-label={t(item.labelKey)}
                            >
                                <motion.div
                                    whileTap={{ scale: 0.95 }}
                                    className={`p-3.5 rounded-full transition-all duration-300 ${
                                        isActive
                                            ? 'bg-primary text-white shadow-lg shadow-primary/40'
                                            : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'
                                    }`}
                                >
                                    <Icon size={28} strokeWidth={2.5} />
                                </motion.div>
                                <span className={`text-[10px] font-semibold tracking-wide mt-1 ${
                                    isActive ? 'text-primary' : 'text-slate-400'
                                }`}>
                                    {t(item.labelKey)}
                                </span>
                            </NavLink>
                        );
                    }

                    // Regular nav items
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className="relative flex flex-col items-center justify-center min-w-[56px] min-h-[56px] px-2"
                        >
                            <div className="relative flex items-center justify-center w-11 h-11">
                                {/* Background pill animation */}
                                <AnimatePresence>
                                    {isActive && (
                                        <motion.div
                                            layoutId="nav-pill"
                                            className="absolute inset-0 bg-primary/15 dark:bg-primary/20 rounded-xl"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        />
                                    )}
                                </AnimatePresence>
                                <Icon
                                    size={26}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={`relative z-10 transition-colors duration-200 ${
                                        isActive
                                            ? 'text-primary'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                />
                            </div>
                            <span className={`text-[10px] font-semibold tracking-wide mt-0.5 transition-colors duration-200 ${
                                isActive ? 'text-primary' : 'text-slate-400'
                            }`}>
                                {t(item.labelKey)}
                            </span>
                        </NavLink>
                    );
                })}
            </div>
        </nav>
    );
};
