import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
