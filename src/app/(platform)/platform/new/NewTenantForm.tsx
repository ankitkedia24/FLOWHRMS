"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createTenantAction } from "@/lib/platform/actions";
import { slugify } from "@/lib/platform/slug";
import { SetupProgress } from "@/components/brand/SetupProgress";

/**
 * Create a customer company.
 *
 * The short name is shown as it will be stored, live, because it is the one
 * value here that cannot be changed afterwards without breaking links.
 * Leaving it blank derives it from the company name, which is right almost
 * always — but "almost always" is not a thing to hide from the person
 * pressing the button.
 */
export function NewTenantForm({
  fromDemoRequestId,
  initialName,
  initialOwnerName,
}: {
  fromDemoRequestId?: string;
  initialName?: string;
  initialOwnerName?: string;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [ownerName, setOwnerName] = useState(initialOwnerName ?? "");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    message: string;
    detail?: string;
    inviteLink?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const effectiveSlug = slug.trim() || slugify(name);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createTenantAction({
        name,
        ownerName,
        ownerEmail,
        slug: slug.trim() || undefined,
        fromDemoRequestId,
      });
      if (result.ok) {
        setDone({
          message: result.message,
          detail: result.detail,
          inviteLink: result.inviteLink,
        });
      } else {
        setError(result.error);
      }
    });
  }

  // While creating, and until the animation has played out after success.
  if (pending || (done && !revealed)) {
    return (
      <Card>
        <SetupProgress
          companyName={name}
          done={Boolean(done)}
          onComplete={() => setRevealed(true)}
          steps={[
            `Creating ${name.trim() || "the company"}`,
            "Setting up roles and permissions",
            "Switching on modules",
            "Preparing the owner's invitation",
          ]}
        />
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <Alert variant="success" title={done.message} live>
          {done.detail}
        </Alert>
        {done.inviteLink && (
          <div className="mt-4">
            <p className="break-all rounded-surface-card border border-border-default bg-surface-sunken px-4 py-3 font-mono text-mono text-text-secondary">
              {done.inviteLink}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              leadingIcon={
                copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />
              }
              onClick={() => {
                void navigator.clipboard
                  .writeText(done.inviteLink!)
                  .then(() => setCopied(true));
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
            <p className="mt-3 text-caption text-text-secondary">
              This link is shown once. If you lose it, open the owner in the
              company and send the invitation again — that issues a new link
              and kills this one.
            </p>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-1">
        {error && <Alert variant="error" title={error} live className="mb-3" />}

        <Input
          label="Company name"
          required
          placeholder="Acme Hardware"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Short name"
          optional
          placeholder={slugify(name) || "acme-hardware"}
          helper={
            effectiveSlug
              ? `Stored as "${effectiveSlug}". This one can't be changed later.`
              : "Used internally. Leave blank to build it from the company name."
          }
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <Input
          label="Owner's name"
          required
          placeholder="Priya Shah"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
        />
        <Input
          label="Owner's email"
          type="email"
          required
          placeholder="owner@acme.example"
          helper="The invitation goes here. They set their own password on it."
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
        />
      </div>

      <div className="mt-5">
        <Button
          size="lg"
          loading={pending}
          disabled={!name.trim() || !ownerName.trim() || !ownerEmail.trim()}
          disabledReason={
            !name.trim() || !ownerName.trim() || !ownerEmail.trim()
              ? "Company name, owner's name and owner's email are all needed."
              : undefined
          }
          onClick={submit}
        >
          Create company
        </Button>
      </div>
    </Card>
  );
}
