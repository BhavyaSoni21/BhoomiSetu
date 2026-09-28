import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useTranslation } from '../context/LanguageContext';
import apiService from '../services/apiService';
import { CaseOut, AppointmentOut, AppointmentCreate } from '../types/aiFlow';
import { X, Calendar, Clock, FileText, User } from 'lucide-react';

interface AppointmentBookingModalProps {
  caseItem: CaseOut;
  isOpen: boolean;
  onClose: () => void;
}

const APPOINTMENT_DEPARTMENTS = ['DISPUTE', 'PLANNING', 'REGISTRATION'];

const AppointmentBookingModal: React.FC<AppointmentBookingModalProps> = ({ caseItem, isOpen, onClose }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);

  const { data: appointments = [] } = useQuery<AppointmentOut[]>(
    ['appointments', caseItem.id],
    async () => (await apiService.get(`/cases/${caseItem.id}/appointments`)).data,
    { enabled: isOpen },
  );

  const mutation = useMutation({
    mutationFn: (payload: AppointmentCreate) => apiService.post(`/cases/${caseItem.id}/appointments`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', caseItem.id] });
      onClose();
    },
  });

  if (!isOpen) return null;

  const handleDocToggle = (doc: string) => {
    setRequiredDocs((prev) =>
      prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc]
    );
  };

  const handleSubmit = () => {
    const payload: AppointmentCreate = {
      citizen_id: caseItem.citizenId,
      department_id: selectedDepartment,
      date: new Date(selectedDate).toISOString(),
      purpose: purpose || undefined,
      required_documents: requiredDocs.length > 0 ? requiredDocs : undefined,
    };
    mutation.mutate(payload);
  };

  const statusLabels: Record<string, string> = {
    REQUESTED: t('appointment.status.requested', 'Requested'),
    CONFIRMED: t('appointment.status.confirmed', 'Confirmed'),
    RESCHEDULED: t('appointment.status.rescheduled', 'Rescheduled'),
    COMPLETED: t('appointment.status.completed', 'Completed'),
    CANCELLED: t('appointment.status.cancelled', 'Cancelled'),
    NO_SHOW: t('appointment.status.noShow', 'No Show'),
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-16 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 animate-fade-up">
        <div className="p-6 border-b border-gov-border flex items-center justify-between">
          <h2 className="text-xl font-heading font-bold text-text-heading">
            {t('appointment.bookingTitle', 'Book an Appointment')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:bg-surface-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {appointments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-heading mb-3">
                {t('appointment.existingAppointments', 'Existing Appointments')}
              </h3>
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <div key={appt.id} className="border border-gov-border rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{new Date(appt.date).toLocaleDateString()}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          appt.status === 'CONFIRMED'
                            ? 'bg-green-100 text-green-800'
                            : appt.status === 'COMPLETED'
                            ? 'bg-blue-100 text-blue-800'
                            : appt.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {statusLabels[appt.status] ?? appt.status}
                      </span>
                    </div>
                    {appt.timeSlot && <div className="text-xs text-text-secondary mt-1">{appt.timeSlot}</div>}
                    {appt.officerId && (
                      <div className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                        <User className="w-3 h-3" /> {appt.officerId}
                      </div>
                    )}
                    {appt.purpose && <div className="text-xs text-text-secondary mt-2">{appt.purpose}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-text-heading mb-3">
              {t('appointment.newAppointment', 'Request New Appointment')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  {t('appointment.departmentLabel', 'Department')}
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gov-border rounded-lg text-sm"
                  required
                >
                  <option value="">{t('appointment.selectDepartment', 'Select a department')}</option>
                  {APPOINTMENT_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {t('appointment.dateLabel', 'Preferred Date')}
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gov-border rounded-lg text-sm"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  {t('appointment.purposeLabel', 'Purpose')}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder={t('appointment.purposePlaceholder', 'Describe the purpose of your visit')}
                  className="w-full px-3 py-2 border border-gov-border rounded-lg text-sm resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  {t('appointment.documentsLabel', 'Required Documents')}
                </label>
                <div className="space-y-2">
                  {['Property Tax Receipt', 'ID Proof', 'Ownership Document'].map((doc) => (
                    <label key={doc} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={requiredDocs.includes(doc)}
                        onChange={() => handleDocToggle(doc)}
                        className="rounded border-gov-border"
                      />
                      <span className="text-text-secondary">{doc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gov-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-2 rounded-lg transition"
          >
            {t('appointment.cancelButton', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedDepartment || !selectedDate || !purpose.trim() || mutation.isPending}
            className="px-4 py-2 text-sm font-bold text-white bg-brand-900 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition"
          >
            {mutation.isPending
              ? t('appointment.submitting', 'Submitting...')
              : t('appointment.submitButton', 'Request Appointment')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentBookingModal;
