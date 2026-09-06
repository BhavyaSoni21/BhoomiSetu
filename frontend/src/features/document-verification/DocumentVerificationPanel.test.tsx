import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocumentVerificationPanel from './DocumentVerificationPanel';
import apiService from '../../services/apiService';

vi.mock('../../services/apiService', () => ({
  default: { post: vi.fn() },
}));

function renderPanel(selectedParcelId: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DocumentVerificationPanel selectedParcelId={selectedParcelId} />
    </QueryClientProvider>,
  );
}

// Same jsdom constraint-validation workaround as ChangeDetectionPanel.test.tsx.
function submitForm() {
  fireEvent.submit(screen.getByRole('button', { name: 'Verify Document' }).closest('form')!);
}

describe('DocumentVerificationPanel', () => {
  beforeEach(() => {
    vi.mocked(apiService.post).mockReset();
  });

  it('prompts to select a parcel first when none is selected', () => {
    renderPanel(null);
    expect(screen.getByText(/to get started/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify Document' })).not.toBeInTheDocument();
  });

  it('shows the upload form once a parcel is selected, disabled until a file is chosen', () => {
    renderPanel('parcel-1');
    expect(screen.getByRole('button', { name: 'Verify Document' })).toBeDisabled();
  });

  it('submits a multipart request with the document and parcelId, and shows a VERIFIED result', async () => {
    vi.mocked(apiService.post).mockResolvedValue({
      data: {
        parcelId: 'parcel-1',
        canonicalParcelId: 'CAN10000',
        extractedText: 'Survey Number: 45/7',
        ocrConfidence: 92,
        fieldChecks: [
          { field: 'IDENTIFIER (SURVEY_NUMBER)', expectedValue: '45/7', status: 'MATCHED' },
          { field: 'OWNER_NAME', expectedValue: 'Amit Sharma', status: 'MATCHED' },
        ],
        overallVerdict: 'VERIFIED',
      },
    });
    renderPanel('parcel-1');

    const file = new File(['doc'], 'doc.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Document Image'), { target: { files: [file] } });
    submitForm();

    expect(await screen.findByText('Verified - matches official records')).toBeInTheDocument();
    expect(apiService.post).toHaveBeenCalledWith('/document-verification/verify', expect.any(FormData), expect.any(Object));
    const formData = vi.mocked(apiService.post).mock.calls[0][1] as FormData;
    expect(formData.get('parcelId')).toBe('parcel-1');
    expect((formData.get('document') as File).name).toBe('doc.png');

    expect(screen.getByText('IDENTIFIER (SURVEY_NUMBER)')).toBeInTheDocument();
    expect(screen.getAllByText('Matched')).toHaveLength(2);
  });

  it('shows a PARTIAL_MATCH result with per-field mismatch status', async () => {
    vi.mocked(apiService.post).mockResolvedValue({
      data: {
        parcelId: 'parcel-1',
        canonicalParcelId: 'CAN10000',
        extractedText: 'text',
        ocrConfidence: 80,
        fieldChecks: [
          { field: 'IDENTIFIER (SURVEY_NUMBER)', expectedValue: '45/7', status: 'MATCHED' },
          { field: 'OWNER_NAME', expectedValue: 'Amit Sharma', status: 'MISMATCH' },
        ],
        overallVerdict: 'PARTIAL_MATCH',
      },
    });
    renderPanel('parcel-1');

    fireEvent.change(screen.getByLabelText('Document Image'), { target: { files: [new File(['doc'], 'doc.png', { type: 'image/png' })] } });
    submitForm();

    expect(await screen.findByText('Partial match - some details differ from official records')).toBeInTheDocument();
    expect(screen.getByText('Matched')).toBeInTheDocument();
    expect(screen.getByText('Mismatch')).toBeInTheDocument();
  });

  it('shows a not-found error message when the parcel 404s', async () => {
    vi.mocked(apiService.post).mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
    renderPanel('parcel-1');

    fireEvent.change(screen.getByLabelText('Document Image'), { target: { files: [new File(['doc'], 'doc.png', { type: 'image/png' })] } });
    submitForm();

    expect(await screen.findByText(/could not be found/)).toBeInTheDocument();
  });
});
