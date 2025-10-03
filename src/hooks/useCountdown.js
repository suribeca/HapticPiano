import { useState, useCallback } from 'react';

/**
 * Hook personalizado para manejar un countdown
 * @param {number} initialCount - Número inicial del countdown (por defecto 3)
 * @param {Function} onComplete - Callback que se ejecuta cuando el countdown termina
 * @returns {Object} { showCountdown, countdown, startCountdown }
 */
export const useCountdown = (initialCount = 3, onComplete) => {
    const [showCountdown, setShowCountdown] = useState(false);
    const [countdown, setCountdown] = useState(initialCount);

    // Inicia el countdown antes de iniciar la práctica
    const startCountdown = useCallback(() => {
        setShowCountdown(true);
        setCountdown(initialCount);

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev === 1) {
                    clearInterval(interval);
                    setShowCountdown(false);

                    // Ejecutar callback cuando termine
                    if (onComplete) {
                        onComplete();
                    }
                }
                return prev - 1;
            });
        }, 1000);
    }, [initialCount, onComplete]);

    return {
        showCountdown,
        countdown,
        startCountdown
    };
};