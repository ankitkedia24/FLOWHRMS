"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { changePasswordAction } from "@/lib/account/actions";
import {
  MIN_PASSWORD_LENGTH,
  validatePasswordChange,
  type PasswordChangeField,
} from "@/lib/account/policy";

/**
 * Current password, new password twice, and the choice to sign out other
 * devices. The client runs the same validation as the server so mistakes
 * are named before a round trip; the server's answer still wins.
 */
export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(false);
  const [problem, setProblem] = useState<{
    field?: PasswordChangeField;
    message: string;
  } | null>(null);
  const [done, setDone] = useState<{ signedOutOthers: boolean } | null>(null);

  const fieldError = (field: PasswordChangeField) =>
    problem?.field === field ? problem.message : undefined;

  if (done) {
    return (
      <Alert variant="success" title="Password changed." live>
        Use the new one from now on.{" "}
        {done.signedOutOthers
          ? "Your other devices have been signed out."
          : "Your other devices stay signed in."}
      </Alert>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        setProblem(null);
        const local = validatePasswordChange({
          currentPassword,
          newPassword,
          confirmPassword,
        });
        if (local) {
          setProblem(local);
          return;
        }
        startTransition(async () => {
          const result = await changePasswordAction({
            currentPassword,
            newPassword,
            confirmPassword,
            signOutOthers,
          });
          if (result.ok) {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setDone({ signedOutOthers: result.signedOutOthers });
          } else {
            setProblem({ field: result.field, message: result.error });
          }
        });
      }}
    >
      {problem && !problem.field && (
        <div className="mb-3">
          <Alert variant="error" title={problem.message} live />
        </div>
      )}

      <Input
        label="Current password"
        type="password"
        required
        autoComplete="current-password"
        error={fieldError("currentPassword")}
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <Input
        label="New password"
        type="password"
        required
        autoComplete="new-password"
        helper={`At least ${MIN_PASSWORD_LENGTH} characters. Not one you use elsewhere.`}
        error={fieldError("newPassword")}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <Input
        label="Confirm new password"
        type="password"
        required
        autoComplete="new-password"
        error={fieldError("confirmPassword")}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <Checkbox
        label="Also sign out of my other devices"
        helper="Any phone or browser where you are still signed in will need the new password. This one stays signed in."
        checked={signOutOthers}
        onChange={(e) => setSignOutOthers(e.target.checked)}
      />

      <div className="mt-3">
        <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
          Change password
        </Button>
      </div>
    </form>
  );
}
