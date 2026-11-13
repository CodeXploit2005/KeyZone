"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { Button, Empty } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  const staleAssets = /(?:failed to load chunk|chunkloaderror|loading (?:css )?chunk .+ failed|failed to fetch dynamically imported module)/i.test(`${error.name}: ${error.message}`);
  return (
    <Empty icon={<CircleAlert />} title={staleAssets ? t.errors.updatedTitle : t.errors.title}>
      <p className={staleAssets ? "text-muted" : "text-danger"}>{staleAssets ? t.errors.updatedBody : error.message}</p>
      <Button className="mt-5" onClick={staleAssets ? () => window.location.reload() : reset}>
        <RotateCcw /> {staleAssets ? t.errors.reload : t.errors.retry}
      </Button>
    </Empty>
  );
}
