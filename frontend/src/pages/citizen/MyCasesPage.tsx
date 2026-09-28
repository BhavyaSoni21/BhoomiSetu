import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CaseOut } from '../../types/aiFlow';
import apiService from '../../services/apiService';
import { useTranslation } from '../../context/LanguageContext';
import AppointmentBookingModal from '../../components/AppointmentBookingModal';
import { Calendar, Eye } from 'lucide-react';

const statusColor: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  // Actual backend Case.status values (see case_service.CASE_STATUSES).
  CREATED: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  RESOLUTION: 'bg-green-100 text-green-800',
  FEEDBACK: 'bg-green-100 text-green-800',
};

const MyCasesPage: React.FC = () => {
  const { t } = useTranslation();
  const [appointmentCase, setAppointmentCase] = useState<CaseOut | null>(null);

  const { data: cases, isLoading, isError } = useQuery({
    queryKey: ['my-cases'],
    queryFn: () => apiService.get<CaseOut[]>('/cases/my').then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="py-6">{t('cases.loading', 'Loading your cases...')}</div>;
  }

  if (isError) {
    return <div className="py-6 text-red-600">{t('cases.error', 'Unable to load cases.')}</div>;
  }

  const caseList = cases ?? [];

  if (caseList.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{t('cases.noCases', 'You have no cases yet.')}</p>
        <Link to="/citizen/get-assistance" className="btn-primary">
          {t('cases.startCase', 'Start a new case')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold mb-4">{t('cases.title', 'My Cases')}</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('cases.caseNumber', 'Case #')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('cases.intent', 'Intent')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('cases.status', 'Status')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('cases.created', 'Created')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('cases.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {caseList.map((c: CaseOut) => (
              <tr key={c.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {c.caseNo}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {c.intent ?? '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      statusColor[c.status] ?? 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {t(`cases.status.${c.status}`, c.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm flex items-center justify-end gap-4">
                  <button
                    onClick={() => setAppointmentCase(c)}
                    className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                    title={t('appointment.bookingTitle', 'Book an appointment')}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>{t('appointment.book', 'Book Appointment')}</span>
                  </button>
                  <Link
                    to={`/citizen/get-assistance?case=${c.id}`}
                    className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{t('cases.view', 'View')}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {appointmentCase && (
        <AppointmentBookingModal
          caseItem={appointmentCase}
          isOpen={true}
          onClose={() => setAppointmentCase(null)}
        />
      )}
    </div>
  );
};

export default MyCasesPage;
