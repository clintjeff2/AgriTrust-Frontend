import React from 'react';

interface CertificateDetailPanelProps {
  certificateId: string;
  score: number;
  isSettled: boolean;
  onClose: () => void;
}

export const CertificateDetailPanel: React.FC<CertificateDetailPanelProps> = ({
  certificateId,
  score,
  isSettled,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full text-center">
        {!isSettled ? (
          <div className="py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Syncing latest verification data...</p>
            <p className="text-xs text-gray-400 mt-2">Loading...</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">Certificate Details</h2>
            <p className="mb-2">ID: {certificateId}</p>
            <div className="bg-gray-100 p-4 rounded mb-4">
              <p className="text-sm text-gray-600">Current Trust Score</p>
              <p className="text-3xl font-bold text-blue-600" data-testid="panel-score">
                {score}%
              </p>
            </div>
            <button
              className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition-colors"
              onClick={onClose}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CertificateDetailPanel;
