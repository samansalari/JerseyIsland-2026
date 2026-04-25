export const dynamic = "force-dynamic";

export const metadata = {
  title: "Scrapers | VotePulse Admin",
  robots: { index: false, follow: false },
};

export default function AdminScrapersPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#0D1B2A] mb-2">Scrapers</h1>
      <p className="text-sm text-gray-500 mb-8">
        Run and monitor the data scrapers.
      </p>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-gray-400 text-sm">Scraper controls coming soon.</p>
      </div>
    </div>
  );
}
