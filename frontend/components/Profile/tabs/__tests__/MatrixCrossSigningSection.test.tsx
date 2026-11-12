import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MatrixCrossSigningSection from '../MatrixCrossSigningSection';
import {
    createMatrixIdentity,
    getCrossSigningStatus,
    removeRecoveryKey,
    saveRecoveryKey,
    verifyMatrixDevice,
} from '../../../../utils/matrixCrossSigningService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
    }),
}));

jest.mock('../../../../utils/matrixCrossSigningService', () => ({
    getCrossSigningStatus: jest.fn(),
    saveRecoveryKey: jest.fn(),
    removeRecoveryKey: jest.fn(),
    verifyMatrixDevice: jest.fn(),
    createMatrixIdentity: jest.fn(),
}));

const mockGet = getCrossSigningStatus as jest.Mock;
const mockSave = saveRecoveryKey as jest.Mock;
const mockRemove = removeRecoveryKey as jest.Mock;
const mockVerify = verifyMatrixDevice as jest.Mock;
const mockCreate = createMatrixIdentity as jest.Mock;

const status = (overrides = {}) => ({
    running: true,
    recoveryKeySet: false,
    deviceVerified: false,
    recoveryAvailable: true,
    lastResult: { state: 'no_key', message: null, at: '2026-11-12' },
    ...overrides,
});

describe('MatrixCrossSigningSection', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders nothing until Matrix is configured', () => {
        const { container } = render(
            <MatrixCrossSigningSection configured={false} isPolling={false} />
        );
        expect(container).toBeEmptyDOMElement();
        expect(mockGet).not.toHaveBeenCalled();
    });

    it('asks for the recovery key while the device is unverified', async () => {
        mockGet.mockResolvedValue(status());
        render(<MatrixCrossSigningSection configured isPolling={false} />);

        expect(
            await screen.findByText('The bot device is not verified.')
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Enter the recovery key of the bot account to verify its device.'
            )
        ).toBeInTheDocument();
        expect(screen.getByTestId('matrix-recovery-key-save')).toBeDisabled();
    });

    it('saves the recovery key and shows the verified state', async () => {
        mockGet.mockResolvedValue(status());
        mockSave.mockResolvedValue(
            status({
                recoveryKeySet: true,
                deviceVerified: true,
                lastResult: { state: 'verified', message: null, at: 'now' },
            })
        );
        render(<MatrixCrossSigningSection configured isPolling={false} />);
        await screen.findByText('The bot device is not verified.');

        fireEvent.change(screen.getByTestId('matrix-recovery-key-input'), {
            target: { value: 'EsTc abcd efgh' },
        });
        fireEvent.click(screen.getByTestId('matrix-recovery-key-save'));

        await waitFor(() =>
            expect(mockSave).toHaveBeenCalledWith('EsTc abcd efgh')
        );
        expect(
            await screen.findByText(/The bot device is verified\./)
        ).toBeInTheDocument();
        expect(screen.getByTestId('matrix-recovery-key-input')).toHaveValue('');
    });

    it('verifies on demand and removes the key', async () => {
        mockGet.mockResolvedValue(
            status({
                recoveryKeySet: true,
                lastResult: {
                    state: 'failed',
                    message: 'MAC mismatch',
                    at: 'now',
                },
            })
        );
        mockVerify.mockResolvedValue(status({ recoveryKeySet: true }));
        mockRemove.mockResolvedValue(status());
        render(<MatrixCrossSigningSection configured isPolling={false} />);

        expect(await screen.findByText('MAC mismatch')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('matrix-verify-device'));
        await waitFor(() => expect(mockVerify).toHaveBeenCalled());

        fireEvent.click(screen.getByRole('button', { name: 'Remove Key' }));
        await waitFor(() => expect(mockRemove).toHaveBeenCalled());
    });

    it('creates an identity for an account without recovery and shows the key once', async () => {
        mockGet.mockResolvedValue(status({ recoveryAvailable: false }));
        mockCreate.mockResolvedValue({
            recovery_key: 'EsTc brand new key',
            status: status({
                recoveryKeySet: true,
                deviceVerified: true,
                recoveryAvailable: true,
            }),
        });
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
        render(<MatrixCrossSigningSection configured isPolling={false} />);

        fireEvent.click(await screen.findByTestId('matrix-create-identity'));

        expect(
            await screen.findByTestId('matrix-created-recovery-key')
        ).toHaveTextContent('EsTc brand new key');
        expect(mockCreate).toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('does not create an identity when the confirm is cancelled', async () => {
        mockGet.mockResolvedValue(status({ recoveryAvailable: false }));
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
        render(<MatrixCrossSigningSection configured isPolling={false} />);

        fireEvent.click(await screen.findByTestId('matrix-create-identity'));
        expect(mockCreate).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });
});
