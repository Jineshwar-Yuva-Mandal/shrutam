import Image from "next/image";

type BrandVariant = "icon" | "complete" | "text";

const brandAssets: Record<BrandVariant, { src: string; width: number; height: number; alt: string }> = {
  icon: { src: "/brand/icon-logo-trim.png", width: 2258, height: 2257, alt: "Shrutam emblem" },
  complete: { src: "/brand/logo-complete-trim.png", width: 2829, height: 708, alt: "Shrutam, Preserving Values | Connecting Communities" },
  text: { src: "/brand/text-logo-trim.png", width: 2831, height: 644, alt: "Shrutam" },
};

export default function BrandLogo({ variant, className, alt, priority = false }: Readonly<{
  variant: BrandVariant;
  className: string;
  alt?: string;
  priority?: boolean;
}>) {
  const asset = brandAssets[variant];
  return <Image
    src={asset.src}
    width={asset.width}
    height={asset.height}
    alt={alt ?? asset.alt}
    className={className}
    priority={priority}
  />;
}
