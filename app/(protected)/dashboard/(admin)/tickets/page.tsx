import TicketList from "@/components/admin/TicketList";
import { getTickets } from "@/lib/actions/ticket/server.actions";
import { Suspense } from "react";
import SkeletonTable from "@/components/ui/skeleton";

async function TicketsData() {
  const tickets = await getTickets();
  return <TicketList initialTickets={tickets} />;
}

export default async function TicketsPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Tickets</h1>
      <div className="flex space-x-6">
        <div className="flex-grow min-w-0 bg-white rounded-lg shadow p-6">
          <Suspense fallback={<SkeletonTable />}>
            <TicketsData />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
