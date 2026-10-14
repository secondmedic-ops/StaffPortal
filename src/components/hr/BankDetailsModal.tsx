import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { lifecycleApi } from '../../api';
import type { Employee } from '../../types';
import { Modal } from '../common/Modal';
import { inputClass, labelClass, primaryBtn, secondaryBtn } from '../common/PageHeader';

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

interface Props {
  employee: Employee | null;
  onClose: () => void;
  onSaved?: () => void;
}

const blank = { panNumber: '', aadhaarNumber: '', uanNumber: '', esicNumber: '', bankName: '', bankIfsc: '', bankAccountNumber: '', bankAccountConfirm: '' };

/** HR edits an employee's statutory IDs and salary bank account. Bank details are mandatory for payroll. */
export const BankDetailsModal: React.FC<Props> = ({ employee, onClose, onSaved }) => {
  const { showToast } = useAuth();
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!employee) return;
    let cancelled = false;
    setForm(blank);
    setLoading(true);
    lifecycleApi
      .getProfile(employee.id)
      .then(p => {
        if (cancelled || !p) return;
        setForm({
          panNumber: p.panNumber ?? '',
          aadhaarNumber: p.aadhaarNumber ?? '',
          uanNumber: p.uanNumber ?? '',
          esicNumber: p.esicNumber ?? '',
          bankName: p.bankName ?? '',
          bankIfsc: p.bankIfsc ?? '',
          bankAccountNumber: p.bankAccountNumber ?? '',
          bankAccountConfirm: p.bankAccountNumber ?? ''
        });
      })
      .catch(err => showToast("Couldn't load details", err.message, 'error'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [employee?.id]);

  const set = (k: keyof typeof blank, v: string) => setForm(f => ({ ...f, [k]: v }));

  const validate = (): string | null => {
    if (!form.bankName.trim()) return 'Bank name is required.';
    if (!IFSC_RE.test(form.bankIfsc.toUpperCase())) return 'IFSC must look like HDFC0001234.';
    if (!/^\d{6,18}$/.test(form.bankAccountNumber)) return 'Enter a valid bank account number (6–18 digits).';
    if (form.bankAccountNumber !== form.bankAccountConfirm) return 'Bank account numbers do not match.';
    if (form.panNumber && !PAN_RE.test(form.panNumber.toUpperCase())) return 'PAN must look like ABCDE1234F.';
    if (form.aadhaarNumber && !/^\d{12}$/.test(form.aadhaarNumber)) return 'Aadhaar must be 12 digits.';
    return null;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    const err = validate();
    if (err) {
      showToast('Check the details', err, 'error');
      return;
    }
    setSaving(true);
    try {
      await lifecycleApi.saveStatutoryDetails(employee.id, {
        panNumber: form.panNumber || undefined,
        aadhaarNumber: form.aadhaarNumber || undefined,
        uanNumber: form.uanNumber || undefined,
        esicNumber: form.esicNumber || undefined,
        bankName: form.bankName,
        bankAccountNumber: form.bankAccountNumber,
        bankIfsc: form.bankIfsc
      });
      showToast('Bank & ID details saved', `${employee.fullName}'s payslips will show this account.`, 'success');
      onSaved?.();
      onClose();
    } catch (error: any) {
      showToast("Couldn't save", error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const mono = `${inputClass} font-mono`;

  return (
    <Modal
      isOpen={!!employee}
      onClose={onClose}
      title={employee ? `Bank & ID details · ${employee.fullName}` : ''}
      subtitle="Bank details are required before payroll can produce a payslip. Visible only to the employee, HR and Accounts."
      maxWidth="xl"
    >
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={loading} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Bank name *</label>
            <input value={form.bankName} onChange={e => set('bankName', e.target.value)} className={inputClass} placeholder="Bank of Maharashtra" />
          </div>
          <div>
            <label className={labelClass}>IFSC *</label>
            <input value={form.bankIfsc} onChange={e => set('bankIfsc', e.target.value.toUpperCase())} maxLength={11} className={mono} placeholder="MAHB0000123" />
          </div>
          <div>
            <label className={labelClass}>Account number *</label>
            <input value={form.bankAccountNumber} onChange={e => set('bankAccountNumber', e.target.value.replace(/\s/g, ''))} inputMode="numeric" className={mono} />
          </div>
          <div>
            <label className={labelClass}>Confirm account number *</label>
            <input
              value={form.bankAccountConfirm}
              onChange={e => set('bankAccountConfirm', e.target.value.replace(/\s/g, ''))}
              onPaste={e => e.preventDefault()}
              inputMode="numeric"
              className={mono}
            />
          </div>
          <div>
            <label className={labelClass}>Aadhaar number</label>
            <input value={form.aadhaarNumber} onChange={e => set('aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" className={mono} placeholder="12 digits" />
          </div>
          <div>
            <label className={labelClass}>PAN</label>
            <input value={form.panNumber} onChange={e => set('panNumber', e.target.value.toUpperCase())} maxLength={10} className={mono} placeholder="ABCDE1234F" />
          </div>
          <div>
            <label className={labelClass}>UAN (PF)</label>
            <input value={form.uanNumber} onChange={e => set('uanNumber', e.target.value)} className={mono} />
          </div>
          <div>
            <label className={labelClass}>ESI number</label>
            <input value={form.esicNumber} onChange={e => set('esicNumber', e.target.value)} className={mono} />
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
          <button type="submit" disabled={saving || loading} className={primaryBtn}>
            {saving ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
