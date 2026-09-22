"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  generateTotpSecret,
  buildOtpauthUri,
  formatSecretDisplay,
} from "@/lib/totp";
import { LiveCodeDisplay } from "./LiveCodeDisplay";
import {
  QrCode,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  KeyRound,
  User,
  Building,
} from "lucide-react";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/lib/ui";

interface TotpSetupCardProps {
  initialSecret?: string;
  initialAccount?: string;
  initialIssuer?: string;
  onSaveConfig?: (secret: string, account: string, issuer: string) => void;
  onCancel?: () => void;
}

export const TotpSetupCard: React.FC<TotpSetupCardProps> = ({
  initialSecret,
  initialAccount = "user@mynexvault.app",
  initialIssuer = "MynexVault",
  onSaveConfig,
  onCancel,
}) => {
  const [secret, setSecret] = useState<string>("");
  const [accountName, setAccountName] = useState<string>(initialAccount);
  const [issuer, setIssuer] = useState<string>(initialIssuer);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [otpUri, setOtpUri] = useState<string>("");
  const [copiedSecret, setCopiedSecret] = useState<boolean>(false);
  const [copiedUri, setCopiedUri] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    if (initialSecret) {
      setSecret(initialSecret);
    } else {
      setSecret(generateTotpSecret());
    }
  }, [initialSecret]);

  useEffect(() => {
    if (!secret) return;
    const uri = buildOtpauthUri(accountName, issuer, secret);
    setOtpUri(uri);

    QRCode.toDataURL(uri, {
      width: 256,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then(setQrCodeDataUrl)
      .catch((err) => console.error("Failed to generate QR code:", err));
  }, [secret, accountName, issuer]);

  const handleRegenerateSecret = () => {
    setIsGenerating(true);
    setSecret(generateTotpSecret());
    setTimeout(() => setIsGenerating(false), 300);
  };

  const handleCopySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch (err) {
      console.error("Failed to copy secret:", err);
    }
  };

  const handleCopyUri = async () => {
    if (!otpUri) return;
    try {
      await navigator.clipboard.writeText(otpUri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    } catch (err) {
      console.error("Failed to copy URI:", err);
    }
  };

  return (
    <div className="w-full rounded-xl bg-panel border border-border p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-background border border-border text-accent">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Setup TOTP 2FA Authentication
            </h3>
            <p className="text-xs text-muted">
              Scan this QR code with Google Authenticator or Authy to pair 2FA
            </p>
          </div>
        </div>

        <button
          onClick={handleRegenerateSecret}
          disabled={isGenerating}
          type="button"
          className={`${secondaryButtonClass} w-auto text-xs px-3 py-1.5`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
          <span>New Secret Key</span>
        </button>
      </div>

      {/* Account Info Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-accent" />
            Account Name
          </label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1 flex items-center gap-1">
            <Building className="w-3.5 h-3.5 text-accent" />
            Issuer / Vault Name
          </label>
          <input
            type="text"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* QR Code & Secret */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-background/60 p-5 rounded-xl border border-border">
        <div className="md:col-span-5 flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-white rounded-xl shadow-md border border-border">
            {qrCodeDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCodeDataUrl}
                alt="TOTP Authenticator QR Code"
                className="w-44 h-44 object-contain rounded"
              />
            ) : (
              <div className="w-44 h-44 flex items-center justify-center text-muted text-xs">
                Generating QR Code...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-center text-muted bg-panel px-3 py-1 rounded-full border border-border">
            <Smartphone className="w-3.5 h-3.5 text-accent shrink-0" />
            <span>Scan with <strong>Google Authenticator</strong></span>
          </div>
        </div>

        <div className="md:col-span-7 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-accent" />
              Raw Base32 Secret Key
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-background px-3.5 py-2.5 rounded-lg border border-border font-mono text-sm font-bold text-accent tracking-wider overflow-x-auto select-all">
                {formatSecretDisplay(secret)}
              </div>
              <button
                onClick={handleCopySecret}
                type="button"
                className={`${secondaryButtonClass} w-auto text-xs px-3 py-2.5`}
                title="Copy Secret"
              >
                {copiedSecret ? (
                  <Check className="w-4 h-4 text-accent" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-accent" />
                OTPAuth URI
              </label>
              <button
                onClick={handleCopyUri}
                type="button"
                className="text-xs text-accent hover:underline"
              >
                {copiedUri ? "Copied!" : "Copy URI"}
              </button>
            </div>
            <p className="bg-background px-3 py-2 rounded border border-border font-mono text-xs text-muted truncate select-all">
              {otpUri}
            </p>
          </div>
        </div>
      </div>

      {/* Integrated Live Code Display */}
      <LiveCodeDisplay secret={secret} period={30} label="Live Synchronized 6-Digit Code" />

      {/* Save / Cancel Controls */}
      {onSaveConfig && (
        <div className="flex items-center justify-end gap-3 pt-2">
          {onCancel && (
            <button
              onClick={onCancel}
              type="button"
              className={`${secondaryButtonClass} w-auto px-4 py-2 text-xs`}
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => onSaveConfig(secret, accountName, issuer)}
            type="button"
            className={`${primaryButtonClass} w-auto px-6 py-2 text-xs`}
          >
            Enable &amp; Save TOTP 2FA
          </button>
        </div>
      )}
    </div>
  );
};
