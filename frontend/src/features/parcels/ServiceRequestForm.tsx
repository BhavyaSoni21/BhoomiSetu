import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import apiService from '../../services/apiService';
import { Workflow } from '../../types/workflow';

interface ServiceRequestFormProps {
  parcelId: string;
  workflowType: string;
  title: string;
  onClose: () => void;
}

const ServiceRequestForm: React.FC<ServiceRequestFormProps> = ({ parcelId, workflowType, title, onClose }) => {
  const [createdBy, setCreatedBy] = useState('');
  const [requestDetails, setRequestDetails] = useState('');

  const mutation = useMutation<Workflow, Error>(async () => {
    const response = await apiService.post('/workflows', {
      parcelId,
      workflowType,
      createdBy: createdBy.trim() || undefined,
      requestDetails: requestDetails.trim() || undefined,
    });
    return response.data;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  if (mutation.isSuccess) {
    const workflow = mutation.data;
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-green-700 mb-2">Request Submitted</h3>
          <p className="text-sm text-gray-600 mb-1">
            Your request has been submitted and is now <strong>{workflow.currentStatus}</strong>.
          </p>
          <p className="text-xs text-gray-500 mb-4">Reference ID: {workflow.id}</p>
          <div className="space-y-1 mb-4 border-t border-b border-gray-100 py-3">
            {workflow.steps.map((step) => (
              <div key={step.id} className="flex justify-between text-sm text-gray-600">
                <span>{step.department.replace(/_/g, ' ')}</span>
                <span className="font-medium">{step.status}</span>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="requestedByInput" className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              id="requestedByInput"
              type="text"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="requestDetailsInput" className="block text-sm font-medium text-gray-700 mb-1">
              Details
            </label>
            <textarea
              id="requestDetailsInput"
              value={requestDetails}
              onChange={(e) => setRequestDetails(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe your request..."
            />
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-600">Something went wrong submitting your request. Please try again.</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {mutation.isLoading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceRequestForm;
