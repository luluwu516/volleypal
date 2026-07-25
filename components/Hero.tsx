import Image from "next/image";
import { LongPressLogo } from "./LongPressLogo";

interface Props {
  title: string;
}

export function Hero({ title }: Props) {
  return (
    <LongPressLogo>
      <section className="flex flex-col items-center gap-2 px-4 py-6">
        <Image
          src="/logo.png"
          alt="VolleyPal"
          width={48}
          height={48}
          priority
          className="size-12"
        />
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-br from-orange-400 to-amber-300 bg-clip-text text-transparent text-center">
          {title}
        </h1>
      </section>
    </LongPressLogo>
  );
}
