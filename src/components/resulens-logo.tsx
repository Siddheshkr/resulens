import Image from "next/image";

type ResuLensLogoProps = Readonly<{
  priority?: boolean;
}>;

export function ResuLensLogo({ priority = false }: ResuLensLogoProps) {
  return (
    <span className="brand-logo-frame" aria-hidden="true">
      <Image
        src="/brand/resulens-logo.png"
        alt=""
        className="brand-logo"
        width={1323}
        height={1189}
        priority={priority}
      />
    </span>
  );
}
