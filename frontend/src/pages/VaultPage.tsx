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
        return <FileCheck className="w-5 h-5 text-orange-400" />;
      case 'bank':
        return <CreditCard className="w-5 h-5 text-amber-400" />;
      default:
        return <Key className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-400" /> Secure Sensitive Vault
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Fernet AES-128 encrypted storage for PAN, Aadhaar, Passport, and Credentials. Never stored plain in vector databases or casual prompts.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Secret Item
        </button>
      </div>

      {/* Security Info Banner */}
      <div className="p-4 rounded-2xl border border-gray-800/80 bg-[#121217] flex items-center gap-3">
        <Lock className="w-5 h-5 text-orange-400 shrink-0" />
        <p className="text-xs text-gray-300 leading-relaxed">
          <strong className="text-white">Zero Plaintext Leakage:</strong> Document uploads with PAN, Aadhaar, or Passport numbers are automatically routed here into AES-128 ciphertext. Jeet will only access them when you specifically ask for them.
        </p>
      </div>

      {/* Vault Items List */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-2xl border border-gray-800/80 bg-[#121217] hover:border-orange-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#181822] border border-gray-800 flex items-center justify-center shrink-0">
                {getItemIcon(item.item_type)}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{item.key_name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                    {item.item_type}
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    {revealedValues[item.id] ? (
                      <span className="text-orange-300 font-bold">{revealedValues[item.id]}</span>
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
                className="px-3 py-1.5 rounded-lg border border-gray-800 hover:border-orange-500/40 text-xs text-gray-300 hover:text-orange-400 flex items-center gap-1.5 transition-colors"
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
                className="p-2 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="p-12 text-center text-xs text-gray-500 border border-dashed border-gray-800 rounded-2xl">
            No sensitive items stored yet. Upload your PAN card, Aadhaar, or add credentials manually.
          </div>
        )}
      </div>

      {/* Add Secret Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#14141a] border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-orange-400" /> Add to Encrypted Vault
            </h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400">Key Name</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. Personal PAN Card Number"
                  className="w-full mt-1 bg-[#0a0a0c] border border-gray-800 rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full mt-1 bg-[#0a0a0c] border border-gray-800 rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500 uppercase"
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
                  <label className="text-xs text-gray-400">Secret Value</label>
                  <input
                    type="password"
                    value={newRawVal}
                    onChange={(e) => setNewRawVal(e.target.value)}
                    placeholder="Raw confidential value"
                    className="w-full mt-1 bg-[#0a0a0c] border border-gray-800 rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400">Notes (Optional)</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Optional context"
                  className="w-full mt-1 bg-[#0a0a0c] border border-gray-800 rounded-xl p-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-800 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold"
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
