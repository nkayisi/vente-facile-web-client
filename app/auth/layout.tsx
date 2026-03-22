import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-3">
          <Link href="/" className="inline-flex items-center">
            <Image src="/logo.png" alt="Vente Facile" width={100} height={100} className="object-contain" />
          </Link>
        </div>
        <div className="rounded-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
