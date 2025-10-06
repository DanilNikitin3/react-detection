// src/components/MacOSStatus.jsx
import React, { useState, useEffect } from 'react';
import MacOSService from './MacOSService';

const MacOSStatus = () => {
    const [status, setStatus] = useState('checking');
    const [dbInfo, setDbInfo] = useState(null);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const health = await MacOSService.checkHealth();
            setStatus(health.database === 'connected' ? 'connected' : 'error');
            
            if (health.database === 'connected') {
                const info = await MacOSService.getDatabaseInfo();
                setDbInfo(info);
            }
        } catch (error) {
            setStatus('error');
        }
    };

    return (
        <div className={`macos-status ${status}`}>
            <h3>🍎 macOS System Status</h3>
            <div className="status-info">
                <p><strong>PostgreSQL:</strong> 
                    <span className={status}>{status === 'connected' ? ' ✅ Connected' : ' ❌ Disconnected'}</span>
                </p>
                {dbInfo && (
                    <>
                        <p><strong>Database:</strong> {dbInfo.database}</p>
                        <p><strong>Records:</strong> {dbInfo.total_records}</p>
                        <p><strong>PostgreSQL Version:</strong> {dbInfo.postgres_version}</p>
                    </>
                )}
            </div>
            <button onClick={checkStatus}>🔄 Refresh Status</button>
        </div>
    );
};

export default MacOSStatus;
