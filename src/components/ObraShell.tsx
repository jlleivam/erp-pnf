import { Outlet } from "@tanstack/react-router";

export function ObraShell() {
  return (
    <div className="min-h-full bg-background flex flex-col">
      <main className="flex-1 p-4 md:p-0 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}

