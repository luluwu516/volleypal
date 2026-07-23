import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 pt-16 text-center">
      <p className="text-4xl">🏐</p>
      <h1 className="text-xl font-bold">找不到這個頁面</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        可能是網址打錯了,或這個頁面已經被移除。
      </p>
      <Link href="/" className="w-full max-w-xs">
        <Button className="w-full">回首頁</Button>
      </Link>
    </div>
  );
}
