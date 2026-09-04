import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import MapComponent from '../map/MapComponent';
import ServiceRequestForm from './ServiceRequestForm';
import { Parcel360Response } from '../../types/parcel360';

type TabKey = 'overview' | 'landRecords' | 'registration' | 'planning' | 'tax' | 'restriction';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'landRecords', label: 'Land Records' },
  { key: 'registration', label: 'Registration' },
  { key: 'planning', label: 'Planning' },
  { key: 'tax', label: 'Tax' },
  { key: 'restriction', label: 'Restriction' },
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
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [serviceRequest, setServiceRequest] = useState<{ workflowType: string; title: string } | null>(null);

  const { data: parcel360, isLoading, error } = useQuery<Parcel360Response>(
    ['parcel-360', id],
    async () => {
      const response = await apiService.get(`/parcels/${id}/360`);
      return response.data;
    },
    { enabled: !!id },
  );

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
          onClose={() => setServiceRequest(null)}
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
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Parcel Map</h2>
        <p className="text-sm text-gray-500 mb-2">
          Selected parcel is highlighted; adjacent and nearby parcels load automatically for spatial context.
        </p>
        <MapComponent parcels={[]} selectedParcelId={parcel360.parcel_id} />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="flex space-x-4">
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
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            onClick={() => window.history.back()}
          >
            Back to Search
          </button>
        </div>
      </div>
    </div>
  );
};

export default Parcel360View;
