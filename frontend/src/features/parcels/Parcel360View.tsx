import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import apiService from '../../services/apiService';
import MapComponent from '../map/MapComponent';
import ServiceRequestForm from './ServiceRequestForm';
import RequestNotifications from './RequestNotifications';
import AiExplanationCard from '../ai/AiExplanationCard';
import { Parcel360Response } from '../../types/parcel360';
import { AiExplanation } from '../../types/aiExplanation';
import { RiskScore } from '../../types/riskScore';

type TabKey = 'overview' | 'landRecords' | 'registration' | 'planning' | 'tax' | 'restriction' | 'dispute';

const RISK_BAND_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'landRecords', label: 'Land Records' },
  { key: 'registration', label: 'Registration' },
  { key: 'planning', label: 'Planning' },
  { key: 'tax', label: 'Tax' },
  { key: 'restriction', label: 'Restriction' },
  { key: 'dispute', label: 'Dispute' },
];

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function NotAvailable({ department }: { department: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-gray-500 text-sm">
      No {department} data is available for this parcel.
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="text-gray-600">
      <strong>{label}:</strong> {value}
    </p>
  );
}

const Parcel360View: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [serviceRequest, setServiceRequest] = useState<{ workflowType: string; title: string } | null>(null);

  // Closing the form (whether cancelled or after a successful submission)
  // refreshes the notification feed below - cheapest way to make a brand new
  // request show up immediately without a manual page reload.
  const closeServiceRequest = () => {
    setServiceRequest(null);
    queryClient.invalidateQueries(['parcel-workflows', id]);
  };

  const { data: parcel360, isLoading, error } = useQuery<Parcel360Response>(
    ['parcel-360', id],
    async () => {
      const response = await apiService.get(`/parcels/${id}/360`);
      return response.data;
    },
    { enabled: !!id },
  );

  const explainMutation = useMutation<AiExplanation, Error>(async () => {
    const response = await apiService.post(`/ai/parcels/${id}/explain`);
    return response.data;
  });

  const { data: riskScore } = useQuery<RiskScore>(
    ['risk-score', id],
    async () => {
      const response = await apiService.get(`/parcels/${id}/risk-score`);
      return response.data;
    },
    { enabled: !!id },
  );

  // Selecting a different parcel on the map below should replace this whole
  // view, not just move the map's own highlight - drop any open modal/tab
  // state that referred to the parcel we're navigating away from.
  useEffect(() => {
    setServiceRequest(null);
    setActiveTab('overview');
    explainMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading) {
    return <div className="flex h-[600px] items-center justify-center">Loading parcel details...</div>;
  }

  if (error) {
    return <div className="flex h-[600px] items-center justify-center">Error loading parcel details</div>;
  }

  if (!parcel360) {
    return <div className="flex h-[600px] items-center justify-center">Parcel not found</div>;
  }

  const { identifiers, location, spatial, sources, departments } = parcel360;
  const statusByDepartment = Object.fromEntries(sources.map((s) => [s.department, s.status]));

  return (
    <div className="space-y-6">
      {serviceRequest && (
        <ServiceRequestForm
          parcelId={parcel360.parcel_id}
          workflowType={serviceRequest.workflowType}
          title={serviceRequest.title}
          onClose={closeServiceRequest}
        />
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-1">Parcel 360</h1>
        <p className="text-sm text-gray-500 mb-4">{parcel360.parcel_id}</p>

        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex flex-wrap gap-4" aria-label="Parcel 360 sections">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'overview' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold mb-2">Identifiers</h2>
              <Field label="ULPIN" value={identifiers.ulpin || 'N/A'} />
              <Field label="Survey Number" value={identifiers.survey_number || 'N/A'} />
              <Field label="Plot Number" value={identifiers.plot_number || 'N/A'} />
              <Field label="Local Identifier" value={identifiers.local_identifier || 'N/A'} />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Location</h2>
              <Field label="State" value={location.state} />
              <Field label="District" value={location.district} />
              <Field label="Locality" value={location.locality} />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Area</h2>
              <Field label="Area" value={`${spatial.area_sq_m.toLocaleString()} m²`} />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Data Sources</h2>
              <div className="space-y-1">
                {sources.map((source) => (
                  <div key={source.department} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{source.department.replace(/_/g, ' ')}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        source.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {source.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'landRecords' && (
          departments.landRecords ? (
            <div className="space-y-1">
              <Field label="Source Schema" value={departments.landRecords.sourceSchema} />
              <Field label="Source Identifier" value={departments.landRecords.sourceIdentifier} />
              <Field label="Owner Name" value={departments.landRecords.ownerName} />
              <Field label="Area" value={`${departments.landRecords.areaSqM.toLocaleString()} m²`} />
              <Field label="Locality" value={departments.landRecords.locality} />
            </div>
          ) : (
            <NotAvailable department={statusByDepartment.LAND_RECORDS ? 'land records' : 'land records (no matching identifier)'} />
          )
        )}

        {activeTab === 'registration' && (
          departments.registration ? (
            <div className="space-y-1">
              <Field label="Status" value={departments.registration.registrationStatus} />
              <Field label="Registration Number" value={departments.registration.registrationNumber || 'N/A'} />
              <Field label="Registration Date" value={formatDate(departments.registration.registrationDate)} />
              <Field label="Last Transaction" value={departments.registration.lastTransactionType || 'N/A'} />
              <Field label="Last Transaction Date" value={formatDate(departments.registration.lastTransactionDate)} />
            </div>
          ) : (
            <NotAvailable department="registration" />
          )
        )}

        {activeTab === 'planning' && (
          departments.planning ? (
            <div className="space-y-1">
              <Field label="Land Use" value={departments.planning.landUse} />
              <Field label="Zoning Classification" value={departments.planning.zoningClassification} />
              <Field label="Master Plan Reference" value={departments.planning.masterPlanReference} />
              <Field label="Building Permission" value={departments.planning.buildingPermissionStatus} />
            </div>
          ) : (
            <NotAvailable department="planning" />
          )
        )}

        {activeTab === 'tax' && (
          departments.tax ? (
            <div className="space-y-1">
              <Field label="Assessed Value" value={formatCurrency(departments.tax.assessedValue)} />
              <Field label="Annual Tax" value={formatCurrency(departments.tax.annualTaxAmount)} />
              <Field label="Tax Status" value={departments.tax.taxStatus} />
              <Field label="Outstanding Amount" value={formatCurrency(departments.tax.outstandingAmount)} />
              <Field label="Last Payment Date" value={formatDate(departments.tax.lastPaymentDate)} />
            </div>
          ) : (
            <NotAvailable department="tax" />
          )
        )}

        {activeTab === 'restriction' && (
          departments.restriction ? (
            <div className="space-y-1">
              <Field label="Has Restriction" value={departments.restriction.hasRestriction ? 'Yes' : 'No'} />
              {departments.restriction.hasRestriction && (
                <>
                  <Field label="Restriction Type" value={departments.restriction.restrictionType || 'N/A'} />
                  <Field label="Details" value={departments.restriction.restrictionDetails || 'N/A'} />
                  <Field label="Imposing Authority" value={departments.restriction.imposingAuthority || 'N/A'} />
                </>
              )}
            </div>
          ) : (
            <NotAvailable department="restriction" />
          )
        )}

        {activeTab === 'dispute' && (
          departments.dispute ? (
            <div className="space-y-1">
              <Field label="Has Active Dispute" value={departments.dispute.hasActiveDispute ? 'Yes' : 'No'} />
              <Field label="Dispute Type" value={departments.dispute.disputeType || 'N/A'} />
              <Field label="Case Status" value={departments.dispute.caseStatus || 'N/A'} />
              <Field label="Filing Date" value={formatDate(departments.dispute.filingDate)} />
              {!departments.dispute.hasActiveDispute && departments.dispute.caseStatus && (
                <>
                  <Field label="Resolution Date" value={formatDate(departments.dispute.resolutionDate)} />
                  <Field label="Resolution Summary" value={departments.dispute.resolutionSummary || 'N/A'} />
                </>
              )}
            </div>
          ) : (
            <NotAvailable department="dispute" />
          )
        )}
      </div>

      <RequestNotifications parcelId={parcel360.parcel_id} />

      {riskScore && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-1">Risk Assessment</h2>
          <p className="text-sm text-gray-500 mb-4">
            A heuristic score combining tax, dispute, governance-alert, and restriction signals — not a prediction
            from a trained model. Each factor below is weighted by how directly it threatens undisputed ownership.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-3xl font-bold text-gray-800">{riskScore.overallScore}</span>
            <span className={`rounded px-3 py-1 text-sm font-medium ${RISK_BAND_COLORS[riskScore.riskBand] ?? 'bg-gray-100 text-gray-700'}`}>
              {riskScore.riskBand}
            </span>
            <span className="text-xs text-gray-400">{Math.round(riskScore.dataCompleteness * 100)}% data coverage</span>
          </div>
          <div className="space-y-1">
            {riskScore.factors.map((factor) => (
              <div key={factor.key} className="flex items-start justify-between gap-3 text-sm border-b py-2 last:border-b-0">
                <div>
                  <span className="font-medium text-gray-700">{factor.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{factor.rationale}</p>
                </div>
                <span className={factor.available ? 'font-semibold text-gray-800 whitespace-nowrap' : 'text-xs text-gray-400 italic whitespace-nowrap'}>
                  {factor.available ? factor.score : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Parcel Map</h2>
        <p className="text-sm text-gray-500 mb-2">
          Selected parcel is highlighted; adjacent and nearby parcels load automatically for spatial context.
          Click another parcel on the map to view its Parcel 360 details.
        </p>
        <MapComponent
          parcels={[]}
          selectedParcelId={parcel360.parcel_id}
          onParcelClick={(clickedId) => {
            if (clickedId !== parcel360.parcel_id) navigate(`/parcels/${clickedId}`);
          }}
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setServiceRequest({ workflowType: 'ROR_COPY_REQUEST', title: 'Request a Copy of Record of Rights (RoR)' })}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Request Documents
          </button>
          <button
            onClick={() => setServiceRequest({ workflowType: 'CORRECTION_REQUEST', title: 'Report an Issue / Request a Correction' })}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Report Issue
          </button>
          <button
            onClick={() => setServiceRequest({ workflowType: 'DISPUTE_FILING', title: 'File a Dispute (Ownership, Boundary, Inheritance, or Encroachment)' })}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            File a Dispute
          </button>
          <button
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            onClick={() => window.history.back()}
          >
            Back to Search
          </button>
          <button
            onClick={() => explainMutation.mutate()}
            disabled={explainMutation.isLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {explainMutation.isLoading ? 'Asking AI...' : 'Explain with AI'}
          </button>
        </div>

        {explainMutation.isError && (
          <p className="text-sm text-red-600 mt-4">
            {axios.isAxiosError(explainMutation.error) && explainMutation.error.response?.status === 503
              ? 'AI is not configured on this server.'
              : 'Something went wrong generating an explanation. Please try again.'}
          </p>
        )}
        {explainMutation.isSuccess && (
          <div className="mt-4">
            <AiExplanationCard explanation={explainMutation.data} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Parcel360View;
