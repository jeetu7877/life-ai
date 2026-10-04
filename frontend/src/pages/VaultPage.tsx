import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { VaultItem } from '../types';
import { Shield, Lock, Eye, EyeOff, Plus, Trash2, Key, CreditCard, FileCheck } from 'lucide-react';

export const VaultPage: React.FC = () => {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newKey, setNewKey] = useState<string>('');
  const [newType, setNewType] = useState<string>('pan');
  const [newRawVal, setNewRawVal] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');

  useEffect(() => {
    loadVaultItems();
  }, []);

  const loadVaultItems = async () => {
    try {
      const data = await api.getVaultItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load vault items:', err);
    }
  };

  const handleReveal = async (id: string) => {
    if (revealedValues[id]) {
      // Hide
      const updated = { ...revealedValues };
      delete updated[id];
      setRevealedValues(updated);
      return;
    }

    try {
      const res = await api.revealVaultItem(id);
      setRevealedValues({ ...revealedValues, [id]: res.decrypted_value });
    } catch (err) {
      console.error('Failed to decrypt vault item:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newRawVal.trim()) return;

    try {
      const created = await api.createVaultItem({
        key_name: newKey.trim(),
        item_type: newType,
        raw_value: newRawVal.trim(),
        notes: newNotes.trim() || undefined
      });
      setItems([...items, created]);
      setNewKey('');
      setNewRawVal('');
      setNewNotes('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to create vault item:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteVaultItem(id);
      setItems(items.filter(i => i.id !== id));
    } catch (err) {
      console.error('Failed to delete vault item:', err);
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'pan':
      case 'aadhaar':
      case 'passport':
        return <FileCheck className="w-5 h-5 text-[#00D9FF]" />;
      case 'bank':
        return <CreditCard className="w-5 h-5 text-amber-400" />;
      default:
        return <Key className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-28 md:pb-8 min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#00D9FF]" /> Secure Sensitive Vault
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Fernet AES-128 encrypted storage for PAN, Aadhaar, Passport, and Credentials. Never stored plain in vector databases or casual prompts.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-white text-xs font-semibold flex items-center gap-2 shadow-[0_0_20px_rgba(0,168,255,0.3)] transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Secret Item
        </button>
      </div>

      {/* Security Info Banner */}
      <div className="p-4 rounded-2xl border border-[#202B3D] bg-[#101722] flex items-center gap-3">
        <Lock className="w-5 h-5 text-[#00D9FF] shrink-0" />
        <p className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white">Zero Plaintext Leakage:</strong> Document uploads with PAN, Aadhaar, or Passport numbers are automatically routed here into AES-128 ciphertext. Life AI will only access them when you specifically ask for them.
        </p>
      </div>

      {/* Vault Items List */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-2xl border border-[#202B3D] bg-[#101722] hover:border-[#00D9FF]/40 hover:bg-[#141C28] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0A0F18] border border-[#202B3D] flex items-center justify-center shrink-0">
                {getItemIcon(item.item_type)}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{item.key_name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/20">
                    {item.item_type}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {revealedValues[item.id] ? (
                      <span className="text-[#00D9FF] font-bold">{revealedValues[item.id]}</span>
                    ) : (
                      item.masked_hint || '••••••••••••'
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => handleReveal(item.id)}
                className="px-3 py-1.5 rounded-xl border border-[#202B3D] hover:border-[#00D9FF]/40 text-xs text-slate-300 hover:text-[#00D9FF] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {revealedValues[item.id] ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" /> Hide
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" /> Reveal
                  </>
                )}
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-2 text-slate-500 hover:text-red-400 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="p-12 text-center text-xs text-slate-400 border border-dashed border-[#202B3D] rounded-2xl bg-[#101722]/40">
            No sensitive items stored yet. Upload your PAN card, Aadhaar, or add credentials manually.
          </div>
        )}
      </div>

      {/* Add Secret Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#101722] border border-[#202B3D] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#00D9FF]" /> Add to Encrypted Vault
            </h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Key Name</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. Personal PAN Card Number"
                  className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] uppercase cursor-pointer"
                  >
                    <option value="pan">PAN Card</option>
                    <option value="aadhaar">Aadhaar Card</option>
                    <option value="passport">Passport</option>
                    <option value="bank">Bank Info</option>
                    <option value="api_key">API Key</option>
                    <option value="other">Other Secret</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Secret Value</label>
                  <input
                    type="password"
                    value={newRawVal}
                    onChange={(e) => setNewRawVal(e.target.value)}
                    placeholder="Raw confidential value"
                    className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF] font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Notes (Optional)</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Optional context"
                  className="w-full mt-1 bg-[#0A0F18] border border-[#202B3D] rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#00D9FF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#202B3D] text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00A8FF] to-[#8B5CF6] hover:from-[#00D9FF] hover:to-[#A855F7] text-white text-xs font-semibold cursor-pointer shadow-md shadow-[#00A8FF]/20"
                >
                  Encrypt & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
