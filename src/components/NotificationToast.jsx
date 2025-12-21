import React, { useEffect, useState } from 'react';
import { useNotification } from '../context/NotificationContext';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import './NotificationToast.css';

export default function NotificationToast() {
    const { notification } = useNotification();
    const [mounting, setMounting] = useState(false);
    const [displayNotification, setDisplayNotification] = useState(null);

    useEffect(() => {
        if (notification) {
            setDisplayNotification(notification);
            // Small timeout to allow render before adding 'show' class for animation
            requestAnimationFrame(() => setMounting(true));
        } else {
            setMounting(false);
        }
    }, [notification]);

    if (!displayNotification) return null;

    const { message, type } = displayNotification;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle size={20} className="toast-icon success" />;
            case 'error': return <AlertCircle size={20} className="toast-icon error" />;
            case 'warning': return <AlertCircle size={20} className="toast-icon warning" />;
            default: return <Info size={20} className="toast-icon info" />;
        }
    };

    return (
        <div className={`notification-toast ${mounting ? 'show' : 'hide'}`}>
            <div className="toast-content">
                {getIcon()}
                <span className="toast-message">{message}</span>
            </div>
        </div>
    );
}
