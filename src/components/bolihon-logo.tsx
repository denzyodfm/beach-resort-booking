import Link from "next/link";

type BolihonLogoProps = {
  href?: string;
  variant?: "header" | "footer" | "hero";
};

const sizes = {
  header: {
    frame: "h-14 w-48 sm:h-16 sm:w-56",
    image: "left-[-22px] top-[-40px] h-[136px] w-[290px] sm:left-[-24px] sm:top-[-48px] sm:h-[158px] sm:w-[336px]",
  },
  footer: {
    frame: "h-14 w-48",
    image: "left-[-20px] top-[-38px] h-[132px] w-[282px]",
  },
  hero: {
    frame: "h-20 w-64 sm:h-24 sm:w-80",
    image: "left-[-28px] top-[-54px] h-[190px] w-[405px] sm:left-[-34px] sm:top-[-66px] sm:h-[230px] sm:w-[490px]",
  },
};

export function BolihonLogo({ href, variant = "header" }: BolihonLogoProps) {
  const logo = (
    <span
      className={`relative block overflow-hidden rounded-md bg-white ${sizes[variant].frame}`}
      aria-label="Bolihon Cove"
    >
      <img
        src="/bolihon-cove-logo.jpg"
        alt="Bolihon Cove"
        className={`absolute max-w-none object-contain ${sizes[variant].image}`}
        decoding="async"
      />
    </span>
  );

  if (!href) return logo;

  return (
    <Link href={href} prefetch className="block shrink-0">
      {logo}
    </Link>
  );
}
