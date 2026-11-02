export function SiteFooter() {
  return (
    <footer className="border-t py-8">
      <div className="container mx-auto max-w-6xl px-4 text-sm text-muted-foreground">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            FundChain is a demo project. It uses Sepolia test ETH, which has no
            real-world value, and campaign content is demo data.
          </p>
          <p className="shrink-0">
            Not a production fundraising service.
          </p>
        </div>
      </div>
    </footer>
  );
}
