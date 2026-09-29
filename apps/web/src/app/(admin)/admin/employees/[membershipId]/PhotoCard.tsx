"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IdCard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { PhotoPicker } from "@/components/employees/PhotoPicker";
import { setEmployeePhotoAction } from "@/lib/employees/actions";

/** Someone's photo, saved as soon as it's taken or chosen, and their ID card. */
export function PhotoCard({
  tenantId,
  membershipId,
  name,
  photoUrl,
  canManage,
}: {
  tenantId: string;
  membershipId: string;
  name: string;
  photoUrl: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PhotoPicker
          tenantId={tenantId}
          name={name}
          initialUrl={photoUrl}
          disabled={!canManage}
          onChange={async (path) => {
            const r = await setEmployeePhotoAction({ membershipId, photoPath: path });
            show({ variant: r.ok ? "success" : "error", message: r.ok ? r.message : r.error });
            if (r.ok) router.refresh();
          }}
        />
        <Link
          href={`/print/id-cards?member=${membershipId}`}
          target="_blank"
          className="inline-flex min-h-11 items-center gap-2 rounded-button border-[1.5px] border-border-strong px-4 text-label text-text-primary hover:bg-surface-sunken"
        >
          <IdCard className="size-4" aria-hidden="true" />
          ID card
        </Link>
      </div>
    </Card>
  );
}
