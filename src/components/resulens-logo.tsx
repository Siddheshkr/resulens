import Image from "next/image";

type ResuLensLogoProps = Readonly<{
  priority?: boolean;
}>;

export function ResuLensLogo({ priority = false }: ResuLensLogoProps) {
  return (
    <span className="brand-logo-frame" aria-hidden="true">
      <Image
        src="/brand/resulens-app-icon.png"
        alt=""
        className="brand-logo"
        width={1254}
        height={1254}
        priority={priority}
      />
    </span>
  );
}
