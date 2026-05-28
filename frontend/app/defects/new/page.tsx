import { DefectNewClient } from "./DefectNewClient";

// searchParams はサーバコンポーネントのpropsで受け取り、クライアントへ渡す
// （useSearchParams のSuspense制約を避けるため）。
export default function DefectNewPage({
  searchParams,
}: {
  searchParams: { lot_id?: string };
}) {
  return <DefectNewClient lotId={searchParams.lot_id ?? ""} />;
}
