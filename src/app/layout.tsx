import type { Metadata } from "next";
import "./globals.css";
import { TimerProvider } from "@/components/TimerContext";
import ActiveTimerBanner from "@/components/ActiveTimerBanner";
import EventTracker from "@/components/EventTracker";
import { ActiveProjectProvider } from "@/components/ActiveProjectContext";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "ProfDev — Performance & Growth Dashboard",
  description: "Track your Jira time logs and send daily standups to Slack and Teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        <ActiveProjectProvider>
          <TimerProvider>
            <Sidebar />

            {/* Main content */}
            <main className="flex-1 overflow-y-auto bg-paper">
              <EventTracker />
              {children}
            </main>
            <ActiveTimerBanner />
          </TimerProvider>
        </ActiveProjectProvider>
      </body>
    </html>
  );
}
