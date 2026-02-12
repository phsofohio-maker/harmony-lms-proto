/**
 * TEMPORARY Bootstrap Panel
 * 
 * Use this once to set custom claims on your test users,
 * then DELETE this file. 
 * 
 * Add to any page: <BootstrapRoles />
 */

import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../services/firebase';

const functions = getFunctions(app);

export const BootstrapRoles: React.FC = () => {
  const [results, setResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const setRole = async (uid: string, role: string, label: string) => {
    try {
      const callable = httpsCallable(functions, 'setUserRole');
      await callable({ targetUid: uid, role });
      setResults(prev => [...prev, `✅ ${label}: role set to "${role}"`]);
    } catch (err: any) {
      setResults(prev => [...prev, `❌ ${label}: ${err.message}`]);
    }
  };

  const bootstrap = async () => {
    setIsRunning(true);
    setResults(['Starting role bootstrap...']);

    // ⚠️ REPLACE THESE WITH YOUR ACTUAL UIDs FROM FIREBASE CONSOLE
    await setRole('ugmPhRIif8fyqSHyYt8RH9Lo0un2', 'admin', 'Admin User');
    await setRole('4zzfbLsuGSdRARex68Hu6mS9nrV2', 'staff', 'Student User');

    setResults(prev => [...prev, '', '🔑 Done! Users must LOG OUT and LOG BACK IN for claims to take effect.']);
    setIsRunning(false);
  };

  return (
    <div style={{ padding: 24, margin: 24, border: '2px dashed red', borderRadius: 8, background: '#fff5f5' }}>
      <h2 style={{ color: 'red', margin: 0 }}>⚠️ Bootstrap Roles (DELETE AFTER USE)</h2>
      <p style={{ color: '#666', fontSize: 14 }}>
        Sets custom claims on Firebase Auth users. Only needed once.
      </p>
      <button
        onClick={bootstrap}
        disabled={isRunning}
        style={{
          padding: '8px 16px',
          background: isRunning ? '#ccc' : '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: isRunning ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        {isRunning ? 'Setting roles...' : '🚀 Set Roles Now'}
      </button>
      <div style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 13 }}>
        {results.map((r, i) => (
          <div key={i}>{r}</div>
        ))}
      </div>
    </div>
  );
};