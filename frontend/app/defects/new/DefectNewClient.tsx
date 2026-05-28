"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Lot } from "@/lib/types";
import { WORKFLOW_STEPS } from "@/lib/utils";
import { Stepper } from "@/components/Stepper";
import { LotInfoCard } from "@/components/LotInfoCard";
import { DefectForm } from "@/components/DefectForm";
import { LoadingState, ErrorState } from "@/components/States";
import { buttonVariants } from "@/components/Button";

export function DefectNewClient({ lotId }: { lotId: string }) {
  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lotId) {
      setLoading(false);
      setError("URLに lot_id がありません。QRコードを読み取るか、トップのサンプルロットから開始してください。");
      return;
    }
    let active = true;
    setLoading(true);
    api
      .getLot(lotId)
      .then((data) => {
        if (active) {
          setLot(data);
          setError(null);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof ApiError ? e.message : "ロット取得に失敗しました。");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [lotId]);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-brand-600">
          <ScanLine size={15} />
          QRコード読み取り後の不具合登録
        </div>
        <Stepper steps={[...WORKFLOW_STEPS]} current={1} />
      </div>

      {loading && <LoadingState label="ロット情報を取得中…" />}

      {!loading && error && (
        <div className="space-y-4">
          <ErrorState message={error} hint={lotId ? `lot_id: ${lotId}` : undefined} />
          <div className="text-center">
            <Link href="/" className={buttonVariants("secondary", "md")}>
              トップへ戻ってサンプルロットを選ぶ
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && lot && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <LotInfoCard lot={lot} />
          <DefectForm lotId={lot.lot_id} />
        </div>
      )}
    </div>
  );
}
