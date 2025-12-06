import React, { useMemo } from 'react';
import { useLogs } from '../store';
import { calculateRiskForecast } from '../utils/predictions';
import { CloudRain, CloudSun, Sun, AlertOctagon, TrendingUp, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const RiskForecast: React.FC = () => {
    const { logs } = useLogs();
    const { t } = useTranslation();

    const forecast = useMemo(() => {
        try {
            return calculateRiskForecast(logs);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Error calculating risk forecast:', error);
            }
            return {
                level: 'low' as const,
                score: 0,
                contributingFactors: [{ key: 'risk.error.calculation' }]
            };
        }
    }, [logs]);

    const getIcon = () => {
        switch (forecast.level) {
            case 'high': return <CloudRain className="text-white" size={48} />;
            case 'moderate': return <CloudSun className="text-white" size={48} />;
            case 'low': return <Sun className="text-yellow-300" size={48} />;
        }
    };

    const getGlassClass = () => {
        switch (forecast.level) {
            case 'high': return 'liquid-glass-red';
            case 'moderate': return 'liquid-glass-orange';
            case 'low': return 'liquid-glass-blue';
        }
    };

    const getTitle = () => {
        switch (forecast.level) {
            case 'high': return t('risk.level.high');
            case 'moderate': return t('risk.level.moderate');
            case 'low': return t('risk.level.low');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${getGlassClass()}`}
        >
            {/* Texture overlay */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 filter contrast-125" />

            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-1 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md w-fit">
                        <TrendingUp size={14} className="text-white" />
                        <span className="text-xs font-bold uppercase tracking-wide">{t('risk.title.today')}</span>
                    </div>

                    <h2 className="text-3xl font-bold mt-2 mb-1 shadow-black/10 drop-shadow-md">
                        {getTitle()}
                    </h2>

                    {forecast.predictedHighArousalTime && (
                        <div className="flex items-center gap-2 mt-2 text-white/90 font-medium bg-black/10 px-3 py-1.5 rounded-lg w-fit">
                            <AlertOctagon size={16} />
                            <span>{t('risk.obs', { time: forecast.predictedHighArousalTime })}</span>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md shadow-inner border border-white/30">
                    {getIcon()}
                </div>
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-white/20">
                <div className="flex items-start gap-2">
                    <Info size={16} className="mt-0.5 shrink-0 opacity-80" />
                    <p className="text-sm font-medium leading-relaxed opacity-90">
                        {forecast.contributingFactors[0]
                            ? t(forecast.contributingFactors[0].key, forecast.contributingFactors[0].params)
                            : t('risk.factors.unknown')
                        }
                    </p>
                </div>
            </div>
        </motion.div>
    );
};
