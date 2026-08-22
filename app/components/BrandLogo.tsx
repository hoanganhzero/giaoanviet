type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export default function BrandLogo({ className = "brand-mark brand-image", alt = "" }: BrandLogoProps) {
  return <img className={className} src="/brand-icon.png" alt={alt} width={64} height={64} aria-hidden={alt ? undefined : true} />;
}
