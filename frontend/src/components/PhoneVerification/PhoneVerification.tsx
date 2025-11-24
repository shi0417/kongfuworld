import React, { useState } from 'react';
import styles from './PhoneVerification.module.css';

interface PhoneVerificationProps {
  onVerificationSuccess: (phoneNumber: string) => void;
  onClose: () => void;
  userId?: number;
}

const PhoneVerification: React.FC<PhoneVerificationProps> = ({
  onVerificationSuccess,
  onClose,
  userId
}) => {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/twilio-verify/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          countryCode,
          userId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStep('code');
        setSuccess('Verification code sent successfully!');
      } else {
        setError(data.message || 'Failed to send verification code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/twilio-verify/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          countryCode,
          code: verificationCode.trim(),
          userId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Phone number verified successfully!');
        setTimeout(() => {
          onVerificationSuccess(countryCode + phoneNumber);
          onClose();
        }, 1500);
      } else {
        setError(data.message || 'Invalid verification code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/twilio-verify/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          countryCode,
          userId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('New verification code sent!');
      } else {
        setError(data.message || 'Failed to resend verification code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendVoiceCode = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/twilio-verify/send-voice-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          countryCode,
          userId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Voice verification call initiated!');
      } else {
        setError(data.message || 'Failed to send voice verification');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Phone Number Verification</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          {step === 'phone' && (
            <div className={styles.phoneStep}>
              <p className={styles.description}>
                Enter your phone number to receive a verification code
              </p>
              
              <div className={styles.phoneInput}>
                <select 
                  value={countryCode} 
                  onChange={(e) => setCountryCode(e.target.value)}
                  className={styles.countryCode}
                >
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+86">🇨🇳 +86</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+81">🇯🇵 +81</option>
                  <option value="+82">🇰🇷 +82</option>
                  <option value="+65">🇸🇬 +65</option>
                </select>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter phone number"
                  className={styles.phoneField}
                />
              </div>

              {error && <div className={styles.error}>{error}</div>}
              {success && <div className={styles.success}>{success}</div>}

              <div className={styles.actions}>
                <button 
                  onClick={handleSendCode} 
                  disabled={loading || !phoneNumber.trim()}
                  className={styles.sendButton}
                >
                  {loading ? 'Sending...' : 'Send SMS Code'}
                </button>
              </div>
            </div>
          )}

          {step === 'code' && (
            <div className={styles.codeStep}>
              <p className={styles.description}>
                Enter the verification code sent to {countryCode}{phoneNumber}
              </p>
              
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter verification code"
                className={styles.codeInput}
                maxLength={6}
              />

              {error && <div className={styles.error}>{error}</div>}
              {success && <div className={styles.success}>{success}</div>}

              <div className={styles.actions}>
                <button 
                  onClick={handleVerifyCode} 
                  disabled={loading || !verificationCode.trim()}
                  className={styles.verifyButton}
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
                
                <div className={styles.resendActions}>
                  <button 
                    onClick={handleResendCode} 
                    disabled={loading}
                    className={styles.resendButton}
                  >
                    Resend SMS
                  </button>
                  <button 
                    onClick={handleSendVoiceCode} 
                    disabled={loading}
                    className={styles.voiceButton}
                  >
                    Call Me Instead
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhoneVerification;

