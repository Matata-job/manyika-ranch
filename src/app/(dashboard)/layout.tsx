import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { redirect } from "next/navigation";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={session.user} />
      <main className="md:pl-64">
        <div className="container mx-auto p-4 md:p-8 pt-16 md:pt-8">{children}</div>
      </main>
    </div>
  );
}
