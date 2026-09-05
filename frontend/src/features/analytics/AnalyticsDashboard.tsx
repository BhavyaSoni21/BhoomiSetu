import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import apiService from '../../services/apiService';
import { AnalyticsSummary, Distribution } from '../../types/analytics';

const BAR_COLOR = '#4f46e5';

const DistributionBarChart: React.FC<{ title: string; data: Distribution[] }> = ({ title, data }) => (
  <div>
    <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
    {data.length === 0 ? (
      <p className="text-xs text-gray-400">No data</p>
    ) : (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="key" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </div>
);

const AnalyticsDashboard: React.FC = () => {
  const { data, isLoading, error } = useQuery<AnalyticsSummary>(['analytics-summary'], async () => {
    const response = await apiService.get('/analytics/summary');
    return response.data;
  });

  if (isLoading) return <div className="text-gray-500 text-sm">Loading analytics...</div>;
  if (error || !data) return <div className="text-gray-500 text-sm">Error loading analytics</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2 text-sm">Total Parcels</h3>
          <p className="text-lg font-bold">{data.totals.parcels}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2 text-sm">Total Workflows</h3>
          <p className="text-lg font-bold">{data.totals.workflows}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2 text-sm">Open Alerts</h3>
          <p className="text-lg font-bold">{data.totals.openAlerts}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="font-medium mb-2 text-sm">Active Disputes</h3>
          <p className="text-lg font-bold">{data.totals.activeDisputes}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <DistributionBarChart title="Tax Status" data={data.taxStatusDistribution} />
        <DistributionBarChart title="Registration Status" data={data.registrationStatusDistribution} />
        <DistributionBarChart title="Land Use" data={data.landUseDistribution} />
        <DistributionBarChart title="Dispute Case Status" data={data.disputeCaseStatusDistribution} />
        <DistributionBarChart title="Workflow Status" data={data.workflowStatusDistribution} />
        <DistributionBarChart title="Workflow Type" data={data.workflowTypeDistribution} />
        <DistributionBarChart title="Alert Severity" data={data.alertSeverityDistribution} />
        <DistributionBarChart title="Alert Status" data={data.alertStatusDistribution} />
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
